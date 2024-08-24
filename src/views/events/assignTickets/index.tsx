import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import HeaderView from "../../../components/headerView";
import { Event, User, Range, AmbassadorRanges } from "../../../interfaces";
import { Button, Form, Input, Row, Table as TableAnt, TableColumnsType, message } from "antd";
import { ColumnsType } from "antd/es/table";
import { QueryConstraint, orderBy, where, writeBatch } from "firebase/firestore";
import FormItem from "antd/es/form/FormItem";
import { DeleteOutlined, ExportOutlined } from "@ant-design/icons";
import { Rule } from "antd/es/form";
import { getCollection, getGenericDocById, update } from "../../../services/firebase";
import Table from "../../../components/table";
import { db } from "../../../firebaseConfig";
import * as XLSX from 'xlsx';

type EventAssign = Omit<Event, "ambassadorsRanges"> & {
  ambassadorsRanges: AmbassadorRanges[];
}

type UserData = {
  Nombre: string;
  Correo: string;
  [key: string]: string | undefined; // Esto permite añadir rangos dinámicos
}

const AssignTickets = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = location;
  const [form] = Form.useForm();
  const [event, setEvent] = useState<EventAssign>();
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [rangesToDelete, setRangesToDelete] = useState<Range[]>([]);
  const [maxNumber, setMaxNumber] = useState({});

  useEffect(() => {
    if (!state) {
      window.location.href = "/eventos";
    }

    const dateEvent = async () => {
      let _event: EventAssign = await getGenericDocById<Event>('Events', state.id!)

      console.log(_event)

      let rangesValues: Record<string, string> = {};

      _event?.ambassadorsRanges.forEach((ambassadorRanges) => {
        ambassadorRanges.ranges.forEach((range) => {
          rangesValues = {
            ...rangesValues,
            [`startRange-${range.index}-${ambassadorRanges.userAmbassadorId}`]: range.startRange!.toString(),
            [`endRange-${range.index}-${ambassadorRanges.userAmbassadorId}`]: range.endRange!.toString(),
          };
        });
      });

      setMaxNumber(_event?.ambassadorsRanges.reduce((max, item) => {
        const ranges = item.ranges || [];
        const endRanges: any = ranges.map(range => range.endRange).filter(endRange => typeof endRange === 'number');
        const maxInItem = Math.max(...endRanges);
        return maxInItem > max ? maxInItem : max;
      }, -Infinity | 0))

      form.setFieldsValue(rangesValues);
      setEvent({ ..._event, ambassadorsRanges: _event.ambassadorsRanges.map(ar => ({ ...ar, ranges: ar.ranges.map(r => ({ ...r, init: true })) })) });
    }

    dateEvent()

  }, [state, form]);

  console.log(event)

  const query = useMemo<QueryConstraint[]>(() => {
    const { companyUid } = state as EventAssign;
    return [
      where("role", "==", "Embajador"),
      where("companyUid", "==", companyUid),
      orderBy("name")
    ]
  }, [state]);

  const ruleMaxRangeForEvent = useMemo<Rule>(() => ({
    message: "El rango no puede ser mayor a la cantidad de boletos del evento.",
    validator: (rule, value?: string) => value && +value > event?.total! ? Promise.reject(rule.message) : Promise.resolve()
  }), [event]);

  const expandedRowRender = (userAssign: User, ranges: Range[]) => {
    const columnsSubTable: TableColumnsType<Range> = [
      {
        width: "40%",
        title: 'Inicio',
        key: 'startRange',
        render: (_, { index }) => <FormItem
          name={`startRange-${index}-${userAssign.id}`}
          label="Inicio"
          rules={[
            {
              required: true, message: "Debe ingresar un inicio de rango.",
            },
            {
              message: "El rango de inicio no puede ser mayor o igual al rango fin.",
              validator: (rule, value?: string) =>
                value && form.getFieldValue(`endRange-${index}-${userAssign.id}`) && +value >= Number(form.getFieldValue(`endRange-${index}-${userAssign.id}`) || 0) ? Promise.reject(rule.message) : Promise.resolve(),
            },
            {
              message: "El rango de inicio no puede ser menor o igual a 0.",
              validator: (rule, value?: string) => value && +value <= 0 ? Promise.reject(rule.message) : Promise.resolve(),
            },
            ruleMaxRangeForEvent
          ]}
        >
          <Input type="number" disabled={event!.ambassadorsRanges.some(ar => ar.userAmbassadorId === userAssign.id && ar.ranges.some(r => r.index === index && r.init))} />
        </FormItem >,
      },
      {
        width: "40%",
        title: 'Fin',
        key: 'endRange',
        render: (_, { index }) => <FormItem
          name={`endRange-${index}-${userAssign.id}`}
          label="Fin"
          rules={[
            {
              required: true, message: "Debe ingresar un fin de rango."
            },
            {
              message: "El rango de fin no puede ser menor o igual al rango inicio.",
              validator: (rule, value?: string) => value && +value <= Number(form.getFieldValue(`startRange-${index}-${userAssign.id}`) || 0) ? Promise.reject(rule.message) : Promise.resolve(),
            },
            {
              message: "El rango de fin no puede ser menor o igual a 0.",
              validator: (rule, value?: string) => value && +value <= 0 ? Promise.reject(rule.message) : Promise.resolve(),
            },
            ruleMaxRangeForEvent
          ]}
        >
          <Input type="number" disabled={event!.ambassadorsRanges.some(ar => ar.userAmbassadorId === userAssign.id && ar.ranges.some(r => r.index === index && r.init))} />
        </FormItem>
      },
      {
        width: "20%",
        title: 'Borrar rango',
        key: 'deleteRange',
        render: (_, { startRange, endRange, index, init }) => <Button
          icon={<DeleteOutlined />}
          style={{ backgroundColor: "#d34745", color: '#fff' }}
          shape="circle"
          onClick={() => {
            if (init) {
              setRangesToDelete(r => [...r, { index, startRange, endRange, init }])
            }

            setEvent(e => ({
              ...e!,
              ambassadorsRanges: e!.ambassadorsRanges.map(
                ar => ar.userAmbassadorId === userAssign.id
                  ? ({ ...ar, ranges: ar.ranges.filter((range) => range.index !== index) })
                  : ar
              )
            }))
          }}
        />
      },
    ];

    return <div style={{ padding: 20 }}>
      <Row>
        <Button
          onClick={() =>
            setEvent(e => ({
              ...e!,
              ambassadorsRanges: e!.ambassadorsRanges.map(
                ar => ar.userAmbassadorId === userAssign.id
                  ? ({ ...ar, ranges: [...ar.ranges, { endRange: undefined, startRange: undefined, index: (ar.ranges[ar.ranges.length - 1]?.index || 0) + 1, init: false }] })
                  : ar
              )
            }))
          }
        >
          Agregar rango
        </Button>
      </Row>
      <br />
      <br />
      <TableAnt rowKey="index" columns={columnsSubTable} showHeader={false} dataSource={ranges} pagination={false} />
    </div>
  }

  const columns = useMemo<ColumnsType<User>>(() => [
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    { title: 'Correo', dataIndex: 'email', key: 'email' },
  ], []);

  const onFinish = async (values: Record<string, string>) => {
    if (saving) return;

    const keysValues = Object.keys(values).filter(k => values[k]);
    const keysValuesStartRange = keysValues.filter(k => k.includes('startRange'));
    const keysValuesEndRange = keysValues.filter(k => k.includes('endRange'));
    const arrayToValidateRanges: Record<string, number>[] = [];
    let ambassadorsRanges: AmbassadorRanges[] = event?.ambassadorsRanges.map(ar => ({ ...ar, ranges: ar.ranges.filter(r => r.init) })) || [];

    keysValuesStartRange.forEach(key => {
      const [_, index, userId] = key.split('-');
      const endRangeKey = keysValuesEndRange.find(k => k.includes(`${index}-${userId}`))!;
      const startRange = values[key];
      const endRange = values[endRangeKey];

      arrayToValidateRanges.push({
        startRange: +startRange,
        endRange: +endRange,
      });

      if (!ambassadorsRanges.some(ar => ar.userAmbassadorId === userId)) {
        ambassadorsRanges.push({
          userAmbassadorId: userId,
          ranges: [{
            index: +index,
            startRange: +startRange,
            endRange: +endRange,
            init: false
          }]
        });
      } else if (ambassadorsRanges.some(ar => ar.userAmbassadorId === userId && !ar.ranges.some(r => r.index === +index))) {
        ambassadorsRanges = ambassadorsRanges.map(ar =>
          ar.userAmbassadorId === userId
            ? { ...ar, ranges: [...ar.ranges, { index: +index, startRange: +startRange, endRange: +endRange, init: false }] }
            : ar
        ) as AmbassadorRanges[];
      }
    });

    const isValidRanges = arrayToValidateRanges.every((range1, index) =>
      arrayToValidateRanges.slice(index + 1).every((range2) =>
        range1.startRange > range2.endRange || range1.endRange < range2.startRange
      )
    );

    if (!isValidRanges) {
      message.error('Rangos no validos, verifique que los rangos sean correctos.');
      return;
    }

    const userAmbassadorIds: string[] = [];

    keysValues.forEach((key) => {
      const userId = key.split('-')[2];

      if (!userAmbassadorIds.includes(userId)) {
        userAmbassadorIds.push(userId);
      }
    });

    setSaving(true);

    try {
      await update("Events", event?.id!, { userAmbassadorIds, ambassadorsRanges });

      for (let j = 0; j < rangesToDelete.length; j++) {
        const range = rangesToDelete[j];
        const start = range.startRange!;
        const end: number = range.endRange!;
        const ranges: { start: number; end: number }[] = [];

        let i = start;

        while (i <= end) {
          const _range = {
            start: i,
            end: Math.min(i + 500, end),
          };

          ranges.push(_range);

          i = _range.end + 1;
        }

        for (let k = 0; k < ranges.length; k++) {
          const _range = ranges[k];

          const { docs } = await getCollection("Tickets", [orderBy("number"), where("number", ">=", _range.start), where("number", "<=", _range.end), where("eventId", "==", event?.id)]);

          const batch = writeBatch(db);

          for (let l = 0; l < docs.length; l++) {
            const ref = docs[l].ref;

            batch.update(
              ref,
              {
                userAmbassadorId: "",
                userAmbassadorName: "",
              }
            );
          }

          await batch.commit();
        }
      }

      const newAmbassadorsRanges: AmbassadorRanges[] = [];

      ambassadorsRanges.forEach(ambassadorRanges => {
        if (ambassadorRanges.ranges.some(r => !r.init)) {
          newAmbassadorsRanges.push(ambassadorRanges)
        }
      });

      for (let i = 0; i < newAmbassadorsRanges.length; i++) {
        const newAmbassadorRanges = newAmbassadorsRanges[i];

        for (let j = 0; j < newAmbassadorRanges.ranges.length; j++) {
          const range = newAmbassadorRanges.ranges[j];

          if (range.init) continue;

          const start = range.startRange!;
          const end: number = range.endRange!;
          const ranges: { start: number; end: number }[] = [];

          let i = start;

          while (i <= end) {
            const _range = {
              start: i,
              end: Math.min(i + 500, end),
            };

            ranges.push(_range);

            i = _range.end + 1;
          }

          for (let k = 0; k < ranges.length; k++) {
            const _range = ranges[k];

            const { docs } = await getCollection("Tickets", [orderBy("number"), where("number", ">=", _range.start), where("number", "<=", _range.end), where("eventId", "==", event?.id)]);

            const batch = writeBatch(db);

            for (let l = 0; l < docs.length; l++) {
              const ref = docs[l].ref;
              const userAmbassadorId = newAmbassadorRanges.userAmbassadorId;
              const userAmbassadorName = users.find(u => u.id === newAmbassadorRanges.userAmbassadorId)?.name || ""

              console.log(event)
              console.log(docs[l].data())

              debugger

              batch.update(
                ref,
                {
                  userAmbassadorId,
                  userAmbassadorName,
                }
              );
            }

            await batch.commit();
          }
        }
      }



      message.success('Boletos asignados con exito.', 4);

      navigate("/eventos");
    } catch (error) {
      console.log(error);
      message.error('Error al asignar los boletos.');
    } finally {
      setSaving(false);
    }
  }

  const handleExport = () => {
    // Prepare the data for export
    const userData: UserData[] = users.map(user => ({
      Nombre: user.name,
      Correo: user.email,
      ...event?.ambassadorsRanges
        .filter(range => range.userAmbassadorId === user.id)
        .flatMap(range => range.ranges.map(r => ({
          [`Rango ${r.index} Inicio`]: r.startRange?.toString(),
          [`Rango ${r.index} Fin`]: r.endRange?.toString(),
        })))
        .reduce((acc, cur) => ({ ...acc, ...cur }), {})
    }));

    // Create a worksheet from the user data
    const wsUsers = XLSX.utils.json_to_sheet(userData, { skipHeader: false });

    // Create cell styles
    const cellStyles = {
      centerBold: { alignment: { horizontal: "center" }, font: { bold: true } },
      textAlignLeft: { alignment: { horizontal: "left" } },
    };

    // Apply styles to the cells
    const rangeCells = (ws: XLSX.WorkSheet) => {
      Object.keys(ws).forEach(cell => {
        if (cell[0] === '!') return; // Skip special keys
        const cellAddress = XLSX.utils.decode_cell(cell);
        const cellValue = ws[cell]?.v;

        if (cellValue && cellAddress.c > 1) { // Only apply to range cells
          ws[cell].s = cellAddress.c % 2 === 0 ? cellStyles.centerBold : cellStyles.textAlignLeft;
        }
      });
    };

    // Adjust column widths based on the data
    const adjustColumnWidths = (ws: XLSX.WorkSheet) => {
      const columnWidths: { [key: string]: number } = {};
      Object.keys(ws).forEach(cell => {
        if (cell[0] === '!') return; // Skip special keys
        const cellAddress = XLSX.utils.decode_cell(cell);
        const cellValue = ws[cell]?.v;
        const col = cellAddress.c;
        if (typeof cellValue === 'string') {
          columnWidths[col] = Math.max(columnWidths[col] || 10, cellValue.length);
        }
      });

      const wsCols = Object.keys(columnWidths).map(col => ({
        wch: columnWidths[col] + 2 // Adding some padding
      }));
      ws['!cols'] = wsCols;
    };

    // Apply styles and adjust column widths
    rangeCells(wsUsers);
    adjustColumnWidths(wsUsers);

    // Create a new workbook and add the worksheet to it
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsUsers, 'Usuarios');

    const filename = `${event?.name}-Embajadores.xlsx`;
    XLSX.writeFile(wb, filename); // Cambié el nombre del archivo aquí
  }

  return (
    <>
      <HeaderView
        title={`Asignador boletos ${event?.name} - Cantidad boletos: ${event?.total} | Rango Mayor: ${maxNumber}`}
        goBack
        path="/eventos"
      />
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
      >
        <Button loading={saving} type="primary" htmlType="submit">Asignar embajadores</Button>
        <Button
          type="default"
          icon={<ExportOutlined />}
          onClick={handleExport}
          style={{ marginLeft: '10px', backgroundColor: '#107C41', color: '#fff' }} // Cambié el color del botón aquí
        >
          Exportar a Excel
        </Button>
        <br />
        <br />
        <Table
          scrollY="60vh"
          collection="Users"
          columns={columns}
          query={query}
          localSearch
          searchValues={{
            name: "Nombre",
            email: "Email",
          }}
          removeTableActions
          expandable={{
            expandedRowRender: (user) => expandedRowRender(user, event?.ambassadorsRanges.find(ar => ar.userAmbassadorId === user.id)?.ranges || []),
            onExpand: (expanded, record) => {
              if (expanded && !event?.ambassadorsRanges.some(ar => ar.userAmbassadorId === record.id)) {
                setEvent(e => ({
                  ...e!,
                  userAmbassadorIds: [...e!.userAmbassadorIds, record.id!],
                  ambassadorsRanges: [...e!.ambassadorsRanges, { userAmbassadorId: record.id!, ranges: [{ startRange: undefined, endRange: undefined, index: 1, init: false }] }]
                }));

                return;
              }
            },
          }}
          onLoadData={setUsers}
        />
      </Form>
    </>
  )
}

export default AssignTickets;