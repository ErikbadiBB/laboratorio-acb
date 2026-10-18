// Comprobaciones de las pruebas: si alguna falla, el proceso termina con error (y GitHub no publica)
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); return ok; };
const done = (label) => {
  if (fails.length) { console.log('FALLOS (' + label + '):\n - ' + fails.join('\n - ')); process.exit(1); }
  console.log('OK ' + label); process.exit(0);
};
module.exports = { check, done };
