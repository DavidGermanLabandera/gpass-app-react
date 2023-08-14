import { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';
import HeaderView from '../../components/headerView';
import Table from '../../components/table';
import { BranchOffice } from "../../interfaces/user";

const Companys = () => {
  const columns: ColumnsType<BranchOffice> = useMemo(() => [
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    { title: 'Correo', dataIndex: 'email', key: 'email' },
    { title: 'Meta ventas / mes', dataIndex: 'salesGoalByMonth', key: 'salesGoalByMonth' }
  ], [])

  return (
    <div>
      <HeaderView  
        title="Empresas"
        path="/sucursales/registrar"
      />      
      <Table 
        url="branchOffice/paginatedListByUserAdmin"
        columns={columns}
        placeholderSearch="Buscar por nombre ó correo..."
        pathEdit="/sucursales/editar"
        urlDisabled="branchOffice/disable"
      />
    </div>
  )
}

export default Companys;