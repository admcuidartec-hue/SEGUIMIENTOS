// test/logica-crm.test.js — Integración con el CRM de leads. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');
const { cita, reglas, MEDICO } = require('./fixtures');
const L = cargar();

const ENC = ['ID', 'FECHA', 'ASESORA', 'APELLIDOS', 'NOMBRES', 'DNI', 'TELEFONO', 'CANAL', 'CANAL_ESPECIFICO', 'CAMPANA', 'ESTATUS'];
const lead = o => [o.id, o.fecha || '2026-07-10 10:00', 'MAGALY', o.apellidos || '', o.nombres || '', o.dni || '', o.tel || '', o.canal === undefined ? 'MENSAJE' : o.canal,
  o.esp === undefined ? 'FACEBOOK ADS' : o.esp, o.campana === undefined ? 'LAB-001' : o.campana, 'ACEPTÓ'];

test('contactosDesdeCrm lee por encabezado, normaliza y descarta leads sin DNI ni nombre', () => {
  const r = plano(L.contactosDesdeCrm(ENC, [
    lead({ id: 'L-1', nombres: 'Rosa  Elena', apellidos: 'Quispe Huaman', dni: '040111222', tel: '987 654 321' }),
    lead({ id: 'L-2', tel: '999111222' }),
    lead({ id: 'L-3', dni: '40222333', tel: '912345678', campana: 'NINGUNA CAMPAÑA', esp: '' }),
    lead({ id: 'L-4', nombres: 'Jorge', apellidos: 'Mendoza', campana: 'NO SE VISUALIZA CAMPAÑA', esp: '', canal: '' })
  ]));
  assert.deepEqual(r.faltantes, []);
  assert.deepEqual(r.contactos.map(c => c.ID_LEAD), ['L-1', 'L-3', 'L-4']);
  assert.deepEqual(r.contactos[0], { ID_LEAD: 'L-1', FECHA: '2026-07-10', NOMBRE: 'Rosa Elena Quispe Huaman', DNI: '40111222',
    TELEFONO: '987654321', CANAL: 'FACEBOOK ADS', CAMPANA: 'LAB-001', DNI_PACIENTE: '', EMPAREJAMIENTO: '' });
  assert.equal(r.contactos[1].CAMPANA, 'Sin campaña');
  assert.equal(r.contactos[1].CANAL, 'MENSAJE');
  assert.equal(r.contactos[2].CAMPANA, 'Sin campaña');
  assert.equal(r.contactos[2].CANAL, 'Sin canal');
});

test('contactosDesdeCrm nombra la columna obligatoria que falta y no devuelve contactos', () => {
  const r = plano(L.contactosDesdeCrm(ENC.filter(c => c !== 'TELEFONO'), [lead({ id: 'L-1', dni: '1' })]));
  assert.deepEqual(r.faltantes, ['TELEFONO']);
  assert.deepEqual(r.contactos, []);
});

test('emparejarContactos: por DNI si el paciente existe; si no, por nombre con un solo candidato', () => {
  const citas = [
    cita({ dni: '40111222', nombre: 'ROSA ELENA QUISPE HUAMAN', fecha: '2026-07-20' }),
    cita({ dni: '40222333', nombre: 'JORGE LUIS MENDOZA PAREDES', fecha: '2026-07-21' }),
    cita({ dni: '40999888', nombre: 'JORGE MENDOZA SALAS', fecha: '2026-07-22' })
  ];
  const contactos = [
    { ID_LEAD: 'L-1', NOMBRE: '', DNI: '40111222' },
    { ID_LEAD: 'L-2', NOMBRE: 'Rosa Quispe', DNI: '77777777' },
    { ID_LEAD: 'L-3', NOMBRE: 'Jorge Mendoza', DNI: '' },
    { ID_LEAD: 'L-4', NOMBRE: 'Pedro Castillo', DNI: '' }
  ];
  assert.equal(L.emparejarContactos(contactos, citas), 2);
  assert.deepEqual(plano(contactos.map(c => [c.DNI_PACIENTE, c.EMPAREJAMIENTO])),
    [['40111222', 'POR DNI'], ['40111222', 'AUTOMÁTICO'], ['', 'POR CONFIRMAR'], ['', 'SIN CANDIDATO']]);
});

const C = o => Object.assign({ ID_LEAD: 'L', FECHA: '2026-07-01', NOMBRE: '', DNI: '', TELEFONO: '', CANAL: 'FACEBOOK ADS',
  CAMPANA: 'LAB-001', DNI_PACIENTE: '', EMPAREJAMIENTO: 'POR DNI' }, o);

test('teléfonos: hierro primero, luego CRM, sin repetidos', () => {
  const citas = [cita({ fecha: '2026-07-01' })];
  const inds = [{ DNI: '40111222', TELEFONO: '987654321', ESTADO: 'ACEPTÓ', TIPO: 'HIERRO', FECHA: '2026-07-01' }];
  const contactos = [C({ DNI_PACIENTE: '40111222', TELEFONO: '987654321' }), C({ ID_LEAD: 'L2', DNI_PACIENTE: '40111222', TELEFONO: '912345678' }),
    C({ ID_LEAD: 'L3', DNI_PACIENTE: '', TELEFONO: '955555555' })];
  const p = L.armarPacientes(citas, inds, [], reglas(L), '2026-10-01', contactos);
  assert.equal(p[0].TELEFONOS, '987654321 / 912345678');
  assert.equal(L.armarPacientes(citas, inds, [], reglas(L), '2026-10-01')[0].TELEFONOS, '987654321', 'sin contactos funciona igual');
});

test('atribución: el lead más reciente anterior o igual a la primera consulta', () => {
  const citas = [cita({ dni: '1', fecha: '2026-08-10' }), cita({ dni: '1', fecha: '2026-09-01' })];
  const contactos = [
    C({ ID_LEAD: 'L-1', FECHA: '2026-07-01', DNI_PACIENTE: '1', CANAL: 'GOOGLE' }),
    C({ ID_LEAD: 'L-2', FECHA: '2026-08-05', DNI_PACIENTE: '1', CANAL: 'FACEBOOK ADS', CAMPANA: 'ANM-001' }),
    C({ ID_LEAD: 'L-3', FECHA: '2026-08-10', DNI_PACIENTE: '1', CANAL: 'INSTAGRAM' }),
    C({ ID_LEAD: 'L-0', FECHA: '2026-08-10', DNI_PACIENTE: '1', CANAL: 'REFERIDO' })
  ];
  assert.deepEqual(plano(L.atribuirCampanas(citas, contactos)), { 1: { CANAL: 'INSTAGRAM', CAMPANA: 'LAB-001', ID_LEAD: 'L-3' } });
});

test('atribución: el lead posterior a la primera consulta no cuenta', () => {
  const citas = [cita({ dni: '1', fecha: '2026-08-10' })];
  const contactos = [C({ ID_LEAD: 'L-0', FECHA: '2026-07-01' }), C({ ID_LEAD: 'L-9', FECHA: '2026-08-20', DNI_PACIENTE: '1', CANAL: 'GOOGLE' })];
  assert.deepEqual(plano(L.atribuirCampanas(citas, contactos))['1'], { CANAL: 'Sin lead en el CRM', CAMPANA: 'Sin lead en el CRM', ID_LEAD: '' });
});

test('atribución: paciente anterior al CRM queda fuera', () => {
  const citas = [cita({ dni: '1', fecha: '2026-06-15' }), cita({ dni: '2', fecha: '2026-07-15' })];
  const contactos = [C({ ID_LEAD: 'L-1', FECHA: '2026-07-01', DNI_PACIENTE: '2' })];
  assert.deepEqual(Object.keys(plano(L.atribuirCampanas(citas, contactos))), ['2']);
  assert.deepEqual(plano(L.atribuirCampanas(citas, [])), {});
});

test('kpiCampanas: nuevos, en curso y volvieron, por mes de primera consulta, médico, canal y campaña', () => {
  const citas = [
    cita({ dni: '1', fecha: '2026-07-10' }), cita({ dni: '1', fecha: '2026-08-05' }),
    cita({ dni: '2', fecha: '2026-07-12' }),
    cita({ dni: '3', fecha: '2026-09-25' })
  ];
  const contactos = [
    C({ ID_LEAD: 'L-1', FECHA: '2026-07-01', DNI_PACIENTE: '1' }),
    C({ ID_LEAD: 'L-2', FECHA: '2026-07-02', DNI_PACIENTE: '2' }),
    C({ ID_LEAD: 'L-3', FECHA: '2026-09-20', DNI_PACIENTE: '3', CANAL: 'GOOGLE', CAMPANA: 'Sin campaña' })
  ];
  assert.deepEqual(plano(L.kpiCampanas(citas, contactos, reglas(L), '2026-10-02')), [
    { MES: '2026-07', MEDICO, CANAL: 'FACEBOOK ADS', CAMPANA: 'LAB-001', NUEVOS: 2, EN_CURSO: 0, VOLVIERON: 1 },
    { MES: '2026-09', MEDICO, CANAL: 'GOOGLE', CAMPANA: 'Sin campaña', NUEVOS: 1, EN_CURSO: 1, VOLVIERON: 0 }
  ]);
});

test('calcularKpi incluye campanas', () => {
  const k = plano(L.calcularKpi([cita({ dni: '1', fecha: '2026-07-10' })], [], [], reglas(L), '2026-10-02',
    [C({ DNI_PACIENTE: '1' })]));
  assert.equal(k.campanas.length, 1);
  assert.deepEqual(plano(L.calcularKpi([], [], [], reglas(L), '2026-10-02')).campanas, []);
});
