import { useState } from 'react'
import DynamicForm from '../../../components/dynamicForm'
import { Card, Form, Grid, message, UploadFile } from 'antd'
// import { post, put } from '../../../services';
import { useNavigate, useLocation } from 'react-router-dom';
import { initCompany, titleForm } from '../../../constants';
import { Company } from '../../../interfaces';
import { TypeRute } from '../../../types';
import HeaderView from "../../../components/headerView";
// import { setImagesToState } from "../../../utils/functions";
// import useAbortController from "../../../hooks/useAbortController";

const { useBreakpoint } = Grid;

const CreateCompany = () => {
  // const abortController = useAbortController();
  const [form] = Form.useForm();
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = location;
  const screens = useBreakpoint();
  const [type, setType] = useState<TypeRute>("create");
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<Company>(initCompany)


  // useEffect(() => {
  //   let _company = { ...state } as Company | null;

  //   setType(_company?.id ? "update" : "create");

  //   if (!_company?.id) return;

  //   _company = setImagesToState(_company);
  //   form.setFieldsValue(_company);
  //   setCompany(_company);
  // }, [state, form])

  const onFinish = async () => {
    if (saving) return;
    const _company = { ...company };
    setSaving(true);
    try {
      if (type === "update") {
        // await put(`company/${type}`, _company, abortController);
      } else {
        // await post(`company/${type}`, _company, abortController);
      }

      message.success('empresa guardada con éxito.', 4);
      navigate('/empresas')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <HeaderView
        title={titleForm[type]}
        path="/empresas"
        goBack
      />
      <Card>
        <DynamicForm
          form={form}
          layout='vertical'
          loading={saving}
          onFinish={onFinish}
          justify="center"
          inputs={[
            {
              typeControl: 'input',
              typeInput: 'text',
              label: 'Nombre',
              name: 'name',
              rules: [{ required: true, message: 'Favor de escribir el nombre del vendedor.' }],
              value: company.name,
              onChange: (value: string) => setCompany({ ...company, name: value }),
              md: 8
            },
            {
              typeControl: 'input',
              typeInput: 'email',
              label: 'Correo',
              name: 'email',
              value: company.email,
              onChange: (value: string) => setCompany({ ...company, email: value }),
              md: 8
            },
            {
              typeControl: 'phone',
              label: 'Teléfono',
              name: 'phone',
              value: company.phone,
              onChange: (value: string) => setCompany({ ...company, phone: value }),
              md: 8
            },
            {
              typeControl: "file",
              label: screens.xs ? "" : "Logo Empresa",
              name: "image",
              value: company.image,
              maxCount: 1,
              accept: "image/png, image/jpeg",
              onChange: (value: UploadFile<any>[]) => setCompany({ ...company, image: value }),
              md: 8,
              styleFI: { display: "flex", justifyContent: "center" },
              multiple: false,
            },
            {
              typeControl: 'textarea',
              typeInput: 'text',
              label: 'Descripción',
              name: 'description',
              rules: [{ required: true, message: 'Favor de escribir la descripción del vendedor.' }],
              value: company.address,
              onChange: (value: string) => setCompany({ ...company, address: value }),
              md: 24
            }
          ]}
        />
      </Card>
    </div>
  )
}

export default CreateCompany;