import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Empty, Table as TableAnt, message } from 'antd';
import { ColumnsType } from 'antd/es/table';
import SearchTable from '../searchTable';
import TableActionsButtons from "./tableActionsButtons";
import { PropsUseCollection } from "../../hooks/useCollection";
import useCollection from "../../hooks/useCollection"
import { getDocById, update } from "../../services/firebase";
import { DocumentData, DocumentSnapshot, QueryConstraint, endAt, orderBy, startAfter, startAt, where } from "firebase/firestore";
import { Document, Page, Image, StyleSheet, pdf } from '@react-pdf/renderer';
import { Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { Ticket } from "../../interfaces";
import { post } from './../../services/index';
import useAbortController from "./../../hooks/useAbortController";
import { useLocation } from 'react-router-dom';
import { Dayjs } from "dayjs";
import { ExpandableConfig } from "antd/lib/table/interface";
import { useAuth } from "./../../context/authContext";

export interface Option {
	key: string;
	label: string;
}

export interface OptiosSearchValues {
	propSearch: string;
	options: Option[];
}

export interface PropsTable<T> extends PropsUseCollection {
	header?: ReactNode;
	columns: ColumnsType<T>;
	wait?: boolean;
	placeholderSearch?: string;
	pathEdit?: string;
	formatDate?: string;
	searchValues: Record<string, string>;
	removeTableActions?: boolean;
	downloadPdf?: boolean;
	imageEventUrl?: string;
	onLoadData?: (data: T[]) => void;
	optiosSearchValues?: OptiosSearchValues[];
	expandable?: ExpandableConfig<any>;
	scrollY?: string;
	localSearch?: boolean;
}

interface TableData {
	search: string | Dayjs[];
	searchKey: string;
	lastDoc?: DocumentSnapshot<DocumentData, DocumentData>;
	collection: string;
}

const { PRESENTED_IMAGE_SIMPLE } = Empty;

const stylesPDF = StyleSheet.create({
	page: {
		flexDirection: 'column',
		backgroundColor: '#FFFFFF',
		position: 'relative',
	},
	backgroundImage: {
		position: 'absolute',
		width: '100%',
		height: '100%',
	},
	qrImage: {
		position: 'absolute',
		top: '45%',
		left: '48%',
		transform: 'translate(-50%, -50%)',
		width: 120, // Ajusta el tamaño del código QR según tus necesidades
		height: 120,
	},
});

const Table = <T extends {}>({
	columns: columnsProp,
	wait, placeholderSearch,
	pathEdit,
	collection,
	query: queryProp,
	formatDate,
	mergeResponse = true,
	searchValues,
	removeTableActions,
	downloadPdf,
	imageEventUrl,
	onLoadData,
	optiosSearchValues,
	expandable,
	scrollY,
	localSearch
}: PropsTable<T>) => {
	const { user } = useAuth();
	const location = useLocation();
	const path = location;
	const abortController = useAbortController();
	const [tableData, setTableData] = useState<TableData>({ search: "", searchKey: "", collection });
	const [search, setSearch] = useState<string | Dayjs[]>("");
	const [searchKey, setSearchKey] = useState("");
	const query = useMemo<QueryConstraint[]>(() => {
		const { search, searchKey, lastDoc } = tableData;
		const _query = [...queryProp];

		if (search && typeof search === "string") {
			const indexOrderBy = _query.findIndex(q => q.type === "orderBy");

			if (indexOrderBy >= 0) {
				_query.splice(indexOrderBy, 1);
			}

			if (searchKey === "number") {
				_query.push(...[orderBy(searchKey), where(searchKey, "==", +search)]);
			} else {
				_query.push(...[orderBy(searchKey), startAt(search), endAt(search + '\uf8ff')]);
			}
		}

		if (search && Array.isArray(search)) {
			const indexOrderBy = _query.findIndex(q => q.type === "orderBy");

			if (indexOrderBy >= 0) {
				_query.splice(indexOrderBy, 1);
			}

			const _search = search as Dayjs[];

			const startDate = _search[0].toDate()
			const endDate = _search[1].toDate()
			startDate.setHours(0, 0, 0, 0)
			endDate.setHours(23, 59, 59, 59)

			_query.push(...[orderBy(searchKey, "desc"), where(searchKey, ">=", startDate), where(searchKey, "<=", endDate)])
		}

		if (lastDoc) {
			_query.push(startAfter(lastDoc));
		}

		return _query;
	}, [tableData, queryProp]);
	const { loading, data, setData } = useCollection<T & { id: string }>({ wait, query, collection: tableData.collection, formatDate, mergeResponse });

	const deleteUser = useCallback((r: T & { id: string; }) => post(`/users/del`, r, abortController.current!), [abortController]);

	useEffect(() => {
		if (loading) return;

		const tableBody = document.querySelector('.ant-table-body');

		tableBody?.addEventListener('scroll', async () => {
			const isBottom = tableBody.scrollTop + tableBody.clientHeight >= tableBody.scrollHeight;

			if (!isBottom) return;

			const elementsWithAttribute = tableBody.querySelectorAll('[data-row-key]');
			const lastElement = elementsWithAttribute[elementsWithAttribute.length - 1] as Element | undefined;

			if (!lastElement) return;

			const lastId = lastElement.getAttribute('data-row-key');

			const doc = await getDocById(collection, lastId!);

			setTableData(prev => ({ ...prev, lastDoc: doc }));
		});

		return () => {
			tableBody?.removeEventListener('scroll', () => { });
		};
	}, [collection, loading]);

	useEffect(() => {
		onLoadData && onLoadData(data);
	}, [data, onLoadData])

	const columns = useMemo<ColumnsType<T>>(() => {
		if (downloadPdf) {
			columnsProp.push({
				title: "Descargar QR",
				dataIndex: "downlaodQr",
				key: "downlaodQr",
				render: (_, ticket) => {
					const t = ticket as any as Ticket;

					return (
						<>
							<Button
								icon={<DownloadOutlined style={{ color: t.isDownloaded ? '#ffffff' : "" }} />}
								style={{ backgroundColor: t.isDownloaded ? '#34d960' : "" }}
								onClick={async () => {
									const canvasQr = document.getElementById(t.number.toString()) as HTMLCanvasElement | null;

									if (!canvasQr) {
										message.error("Error al descargar el ticket, intentelo de nuevo", 4);
										return;
									}

									const newWidth = 400;
									const newHeight = 400;
									const resizedCanvas = document.createElement("canvas");

									resizedCanvas.width = newWidth;
									resizedCanvas.height = newHeight;

									const ctx = resizedCanvas.getContext("2d");

									ctx?.drawImage(canvasQr, 0, 0, newWidth, newHeight);

									const ticketUrl = resizedCanvas.toDataURL("image/octet-stream");

									const blob = await pdf(<Document>
										<Page size={{ width: 440, height: 800 }} style={stylesPDF.page}>
											<Image src={imageEventUrl} style={stylesPDF.backgroundImage} />
											{
												<Image
													src={ticketUrl}
													style={stylesPDF.qrImage}
												/>
											}
										</Page>
									</Document>).toBlob();

									const url = window.URL.createObjectURL(blob);
									const a = document.createElement('a');
									a.href = url;
									a.download = `Ticket-${t?.userAmbassadorName}-#${t.number}`;
									a.click();
									a.remove();

									setData(prev => prev.map(_ticket => _ticket.id === t.id ? ({ ..._ticket, isDownloaded: true }) as any as Ticket : _ticket) as (T & { id: string; })[]);

									if (!t.isDownloaded) {
										await update("Tickets", t.id as string, { ...t, isDownloaded: true })
									}
								}}
							/>
						</>
					)
				}
			})
		}

		if (removeTableActions || ["Administrador", "Embajador", "Lector"].includes(user?.displayName!)) return columnsProp.map(c => ({ ...c, width: c.width || 150 }));

		return [
			...columnsProp.map(c => ({ ...c, width: c.width || 150 })),
			{
				title: 'Acciones',
				key: 'actions',
				fixed: 'right',
				width: 100,
				render: (_, record: T) => {
					const r = record as T & { id: string };
					return (
						<TableActionsButtons
							record={record}
							onDeleted={() => {
								setTableData(prev => ({ ...prev, lastDoc: undefined, collection: "" }))
								setTimeout(() => {
									setTableData(prev => ({ ...prev, collection }))
								}, 200)
							}}
							fun={() => path.pathname === "/usuarios" ? deleteUser(r) : update(collection, r.id, { disabled: true })}
							pathEdit={pathEdit}
						/>
					)
				},
			}
		];
	}, [columnsProp, pathEdit, collection, removeTableActions, downloadPdf, imageEventUrl, setData, path, deleteUser, user]);

	return (
		<div>
			<SearchTable
				onSearch={(_search, _searchKey) => {
					if (localSearch) {
						setSearch(_search);
						setSearchKey(_searchKey);
						return;
					}

					setTableData(prev => ({ ...prev, lastDoc: undefined, collection: "" }));
					setTimeout(() => {
						setTableData(prev => ({ ...prev, search: _search, searchKey: _searchKey, collection }));
					}, 200)
				}}
				placeholder={placeholderSearch}
				searchValues={searchValues}
				optiosSearchValues={optiosSearchValues}
			/>
			<br />
			<TableAnt
				sticky
				scroll={{ x: 400, y: scrollY || "75vh", scrollToFirstRowOnChange: false }}
				columns={columns}
				dataSource={searchKey && search ? data.filter(f => (f[searchKey as keyof T] as string).toLowerCase().includes(search.toString().toLowerCase())) : data}
				loading={loading}
				locale={{ emptyText: <Empty image={PRESENTED_IMAGE_SIMPLE} description='Sin registros.' /> }}
				rowKey="id"
				pagination={false}
				expandable={expandable}
			/>
		</div>
	)
}

export default Table;