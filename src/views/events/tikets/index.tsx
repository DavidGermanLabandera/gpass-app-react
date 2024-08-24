import { useEffect, useMemo, useState } from "react"
import { QueryConstraint, limit, orderBy, where } from "firebase/firestore"
import HeaderView from "../../../components/headerView"
import Table, { PropsTable } from "../../../components/table"
import { ColumnsType } from "antd/es/table"
import { Event, Ticket, User } from "../../../interfaces"
import { useLocation } from "react-router-dom"
import dayjs from "dayjs"
import { QRCodeCanvas } from "qrcode.react"
import useCollection, { PropsUseCollection } from "../../../hooks/useCollection"
import { Button, Form } from "antd"
import { useAuth } from "../../../context/authContext"
import { ExportOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

interface TicketTable extends Ticket {
  ticketUrl?: string;
}

const Tickets = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { state } = location;
  const propsUseCollection = useMemo<PropsUseCollection>(() => ({
    collection: "Users",
    query: [where("role", "in", ["Embajador", "Lector"])]
  }), []);
  const { loading, data: users } = useCollection<User>(propsUseCollection);
  const [tickets, setTickets] = useState<TicketTable[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!tickets.length) return;

    const values: Record<string, string | undefined> = {};

    tickets.forEach((ticket) => {
      values[`userAmbassadorId-${ticket.number}`] = ticket.userAmbassadorId;
    });

    form.setFieldsValue(values);
  }, [form, tickets])

  const event = useMemo(() => {
    if (state) {
      return state as Event;
    }

    window.location.href = "/eventos";

    return undefined;
  }, [state]);

  const columns = useMemo<ColumnsType<TicketTable>>(() => [
    { title: 'Numero', dataIndex: 'number', key: 'number' },
    { title: 'Escaneado', dataIndex: 'isScanned', key: 'isScanned' },
    { title: 'Usuario escaner', dataIndex: 'userScannerName', key: 'userScannerName' },
    {
      title: "Fecha escaneado",
      dataIndex: "dateScanned",
      key: "dateScanned",
      render: (_, ticket) => (ticket.dateScanned ? dayjs(ticket.dateScanned).format("DD/MM/YYYY hh:mm a") : "")
    },
    {
      title: "Embajador",
      dataIndex: "userAmbassadorId",
      key: "userAmbassadorId",
      render: (_, ticket) => (users.find(u => u.id === ticket.userAmbassadorId)?.name || "")
    },
    {
      title: "",
      dataIndex: "qr",
      key: "qr",
      render: (_, ticket) => (
        <QRCodeCanvas value={`${event?.id}-${ticket.number}`} id={ticket.number.toString()} style={{ display: "none" }} />
      )
    }
  ], [event, users]);

  const query = useMemo<QueryConstraint[]>(() => {
    const query = [where("eventId", "==", event?.id || ""), orderBy("number"), limit(20)];

    if (user?.displayName === "Lector") {
      query.push(where("userScannerId", "==", user.uid || ""));
    }

    if (user?.displayName === "Embajador") {
      query.push(where("userAmbassadorId", "==", user.uid || ""));
    }

    return query;
  }, [event, user]);

  const propsTable = useMemo<PropsTable<TicketTable>>(() => ({
    wait: loading,
    columns: columns,
    placeholderSearch: "Buscar por nombre embajador / lector,numero...",
    collection: "Tickets",
    query,
    formatDate: "DD/MM/YYYY hh:mm a",
    searchValues: {
      userAmbassadorName: "Nombre Embajador",
      userScannerName: "Nombre lector",
      number: "Número",
      isScanned: "Escanedo",
      dateScanned: "Fecha escaneado",
    },
    optiosSearchValues: [
      {
        propSearch: "isScanned",
        options: [
          {
            key: "",
            label: "Sin filtro"
          },
          {
            key: "Si",
            label: "Si"
          },
          {
            key: "No",
            label: "No"
          }
        ]
      }
    ],
    removeTableActions: true,
    downloadPdf: true,
    imageEventUrl: event?.image as string,
    onLoadData: setTickets
  }), [event, columns, loading, query]);

  const handleExport = () => {
    // Prepare the data for export
    const ticketData = tickets.map(ticket => ({
      Número: ticket.number,
      Escaneado: ticket.isScanned,
      "Usuario escaner": ticket.userScannerName || "",
      "Fecha escaneado": ticket.dateScanned ? dayjs(ticket.dateScanned).format("DD/MM/YYYY hh:mm a") : "",
      "Embajador": users.find(u => u.id === ticket.userAmbassadorId)?.name || "",
    }));
  
    // Create a worksheet from the ticket data
    const wsTickets = XLSX.utils.json_to_sheet(ticketData);
  
    // Helper function to get the maximum length of content for a column
    const getMaxLength = (data: any[], key: string): number => {
      return Math.max(
        ...data.map(row => (row[key]?.toString().length || 0)),
        key.length
      );
    };
  
    // Define column widths based on the data
    const columnWidths: { [key: string]: number } = {
      Número: getMaxLength(ticketData, 'Número'),
      Escaneado: getMaxLength(ticketData, 'Escaneado'),
      "Usuario escaner": getMaxLength(ticketData, 'Usuario escaner'),
      "Fecha escaneado": getMaxLength(ticketData, 'Fecha escaneado'),
      Embajador: getMaxLength(ticketData, 'Embajador'),
    };
  
    // Set column widths for the worksheet
    wsTickets['!cols'] = Object.keys(columnWidths).map(key => ({
      width: columnWidths[key] + 2 // Add some padding
    }));
  
    // Generate a new workbook and append the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsTickets, 'Tickets');
  
    // Generate the file name
    const filename = `${event?.name}-Tickets.xlsx`;
  
    // Export the workbook to a file
    XLSX.writeFile(wb, filename);
  };  

  return (
    <div style={{ margin: 20 }}>
      <HeaderView
        path="/eventos"
        title={`Tickets ${event?.name}`}
        goBack
      />
       <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
        <Button
          type="default"
          icon={<ExportOutlined />}
          onClick={handleExport}
          style={{ backgroundColor: '#107C41', color: '#fff' }}
        >
          Exportar a Excel
        </Button>
      </div>
      <Table {...propsTable} />
    </div>
  )
}

export default Tickets;