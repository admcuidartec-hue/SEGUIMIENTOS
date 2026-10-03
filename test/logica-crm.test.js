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
