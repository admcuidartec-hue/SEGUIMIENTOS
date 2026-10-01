// Datos inventados. Nunca use nombres ni DNI reales de pacientes.
const MEDICO = 'Dra. KAREN DIANA MATOS PEÑA';

function cita(o) {
  const dni = o.dni || '40111222';
  const esp = o.esp || 'HEMATOLOGÍA';
  return {
    IDCITA: o.id || ('C-' + dni + '-' + o.fecha + '-' + esp),
    DNI: dni,
    NOMBRE: o.nombre || 'ROSA ELENA QUISPE HUAMAN',
    FECHA: o.fecha,
    ESTADO: o.estado || 'REALIZADO',
    ESPECIALIDAD: esp,
    MEDICO: o.medico || MEDICO,
    MODALIDAD: 'CLÍNICA'
  };
}

function seg(o) {
  return {
    ID: 'S-' + (o.dni || '40111222') + '-' + o.fecha + '-' + (o.accion || 'HECHO'),
    FECHA_HORA: o.fecha + ' 10:00',
    DNI: o.dni || '40111222',
    ESPECIALIDAD: o.esp || 'HEMATOLOGÍA',
    RESPONSABLE: o.quien || 'MAGALY',
    ACCION: o.accion || 'HECHO',
    MOTIVO: o.motivo || '',
    NOTA: ''
  };
}

function reglas(L) {
  return L.reglasDesdeFilas(
    ['ESPECIALIDAD', 'ESPERADO_DIAS', 'VENCE_DIAS', '', 'PARAMETRO', 'VALOR'],
    [['*', 30, 45, '', 'ESPERA_TRAS_SEGUIMIENTO_DIAS', 15],
     ['HEMATOLOGÍA', 30, 45, '', 'MAX_SEGUIMIENTOS', 3],
     ['REUMATOLOGIA', 60, 90, '', 'CORTE_BANDEJA_DIAS', 180]]);
}

module.exports = { cita, seg, reglas, MEDICO };
