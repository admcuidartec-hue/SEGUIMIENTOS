// Roles (26/10/2026): admisionistas, enfermera y usuarios de solo consulta. Datos inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar, plano } = require('./cargar');

const L = cargar();

test('catalogosDesdeFilas: USUARIOS_CONSULTA y USUARIOS_ENFERMERIA también son usuarios de «¿Quién es usted?»', () => {
  const c = plano(L.catalogosDesdeFilas(['USUARIOS', 'USUARIOS_CONSULTA', 'USUARIOS_ENFERMERIA'],
    [['MAGALY', 'ADMINISTRACION', 'ENFERMERA PRUEBA'], ['ANA', 'MARKETING', ''], ['ENFERMERA PRUEBA', '', '']]));
  assert.deepEqual(c.usuarios, ['MAGALY', 'ANA', 'ENFERMERA PRUEBA', 'ADMINISTRACION', 'MARKETING']);
  assert.deepEqual(c.consulta, ['ADMINISTRACION', 'MARKETING']);
  assert.deepEqual(c.enfermeria, ['ENFERMERA PRUEBA']);
  const sin = plano(L.catalogosDesdeFilas(['USUARIOS'], [['MAGALY']]));
  assert.deepEqual([sin.consulta, sin.enfermeria], [[], []]);
});

test('rolDe: consulta gana a enfermería y enfermería a admisión; comparación normalizada', () => {
  const c = { usuarios: ['MAGALY', 'ENFERMERA PRUEBA', 'ADMINISTRACION'], consulta: ['Administración'], enfermeria: ['enfermera prueba'] };
  assert.equal(L.rolDe(c, 'magaly'), 'ADMISION');
  assert.equal(L.rolDe(c, 'ENFERMERA PRUEBA'), 'ENFERMERIA');
  assert.equal(L.rolDe(c, 'ADMINISTRACION'), 'CONSULTA');
  assert.equal(L.rolDe(c, 'NADIE'), '');
  assert.equal(L.rolDe({ usuarios: ['MAGALY'] }, 'MAGALY'), 'ADMISION', 'sin las columnas nuevas, todos son admisión');
});

test('errorDeRol: los tres mensajes', () => {
  const c = { usuarios: ['MAGALY', 'ENFERMERA PRUEBA', 'MARKETING'], consulta: ['MARKETING'], enfermeria: ['ENFERMERA PRUEBA'] };
  assert.equal(L.errorDeRol(c, 'MAGALY', 'ADMISION'), '');
  assert.equal(L.errorDeRol(c, 'ENFERMERA PRUEBA', 'ENFERMERIA'), '');
  assert.equal(L.errorDeRol(c, 'MAGALY', 'ENFERMERIA'), 'Esta acción es de enfermería.');
  assert.equal(L.errorDeRol(c, 'ENFERMERA PRUEBA', 'ADMISION'), 'Esta acción es de admisión.');
  assert.equal(L.errorDeRol(c, 'MARKETING', 'ADMISION'), 'Usuario de solo consulta: no puede modificar datos.');
  assert.equal(L.errorDeRol(c, 'MARKETING', 'ENFERMERIA'), 'Usuario de solo consulta: no puede modificar datos.');
  assert.equal(L.errorDeRol(c, 'NADIE', 'ADMISION'), '', 'quien no está lo rechaza «Elija quién es usted»');
});

/* ---- Todas las funciones que escriben × los tres roles, sin escribir nada (ni BITACORA) ---- */
const ARCHIVOS = ['Logica.gs', 'Registro.gs', 'Resultados.gs', 'Tablero.gs', 'Enfermeria.gs', 'Codigo.gs', 'RegistroServidor.gs',
  'ResultadoServidor.gs', 'EnfermeriaServidor.gs', 'Menu.gs'];
const CAT = { usuarios: ['MAGALY', 'ENFERMERA PRUEBA', 'MARKETING'], consulta: ['MARKETING'], enfermeria: ['ENFERMERA PRUEBA'], motivos: ['OTRO'], alias: {},
  doctores: [], procedimientos: ['SANGRÍA'], tratamientos: ['HIERRO SACARATO'], marcas: {}, reacciones: ['Náuseas'] };
const ESCRIBEN = {
  registrarResultado: 'ADMISION', anularResultado: 'ADMISION', marcarSeguimiento: 'ADMISION', descartar: 'ADMISION',
  marcarSesion: 'ADMISION', anularSesion: 'ADMISION', guardarRegistro: 'ADMISION', editarRegistro: 'ADMISION', anularRegistro: 'ADMISION',
  darDeAlta: 'ADMISION', anularAlta: 'ADMISION', asignarDniIndicacion: 'ADMISION', confirmarEmparejamiento: 'ADMISION',
  registrarContactoEnfermeria: 'ENFERMERIA', anularContactoEnfermeria: 'ENFERMERIA'
};
const MENSAJE = { CONSULTA: /^Usuario de solo consulta: no puede modificar datos\.$/, ADMISION: /^Esta acción es de admisión\.$/, ENFERMERIA: /^Esta acción es de enfermería\.$/ };
const QUIEN = { ADMISION: 'MAGALY', ENFERMERIA: 'ENFERMERA PRUEBA', CONSULTA: 'MARKETING' };

test('cada función que escribe rechaza al rol que no le toca, antes de leer o escribir nada (tampoco BITACORA)', () => {
  const ctx = cargar(ARCHIVOS);
  const escrito = [];
  ctx.MEMO = {};
  ctx.datos_ = () => ({ hoy: '2026-10-05', catalogos: CAT, reglas: ctx.reglasDesdeFilas([], []), citas: [], indicaciones: [], indicacionesTodas: [],
    seguimientos: [], seguimientosTodos: [], registros: [], sesiones: [], altas: [], enfermeria: [], contactos: [], vigentes: {}, telefonos: {}, pacientes: [], pendientes: [] });
  ctx.bloquear_ = () => { escrito.push('candado'); return { releaseLock: () => {} }; };
  ctx.anexarObjeto_ = n => escrito.push(n);
  ctx.bitacora_ = () => escrito.push('BITACORA');
  ctx.marcarAnulado_ = n => escrito.push('anular ' + n);
  ctx.hoja_ = () => { throw new Error('no debía abrir una hoja'); };
  ctx.SpreadsheetApp = { flush: () => {} };
  const visto = [];
  for (const [fn, rol] of Object.entries(ESCRIBEN)) {
    assert.equal(typeof ctx[fn], 'function', fn);
    for (const otro of ['ADMISION', 'ENFERMERIA', 'CONSULTA'].filter(r => r !== rol)) {
      const p = { usuario: QUIEN[otro], dni: '40111222', id: 'X-1', motivo: 'm', especialidad: 'HEMATOLOGÍA', resultado: 'NO CONTESTÓ', clave: 'SES-1|1' };
      assert.throws(() => ctx[fn](p), e => MENSAJE[otro === 'CONSULTA' ? 'CONSULTA' : rol].test(e.message), `${fn} con ${otro}`);
      visto.push(fn + '×' + otro);
    }
  }
  assert.deepEqual(escrito, [], 'nada escrito ni el candado tomado');
  assert.equal(visto.length, Object.keys(ESCRIBEN).length * 2);
});
