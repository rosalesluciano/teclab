// TKL, 87 teclas, ANSI. Una sola fuente de verdad para el modelo 3D y el plano 1:1.
// x, y y w en unidades de tecla (1u = 19,05 mm). `code` es KeyboardEvent.code,
// o sea la posición física: funciona igual con cualquier distribución del sistema.
export const U = 19.05;
export const BEZEL = 12;          // mm de aluminio alrededor del bloque de teclas
export const COLS = 18.25;
export const ROWS = 6.5;

const K = [];
const add = (code, legend, x, y, w = 1) => K.push({ code, legend, x, y, w });

add('Escape', 'Esc', 0, 0);
['F1','F2','F3','F4'].forEach((c, i) => add(c, c, 2 + i, 0));
['F5','F6','F7','F8'].forEach((c, i) => add(c, c, 6.5 + i, 0));
['F9','F10','F11','F12'].forEach((c, i) => add(c, c, 11 + i, 0));
add('PrintScreen', 'PrtSc', 15.25, 0); add('ScrollLock', 'ScrLk', 16.25, 0); add('Pause', 'Pause', 17.25, 0);

add('Backquote', '`', 0, 1.5);
'1234567890'.split('').forEach((d, i) => add('Digit' + d, d, 1 + i, 1.5));
add('Minus', '-', 11, 1.5); add('Equal', '=', 12, 1.5); add('Backspace', 'Backspace', 13, 1.5, 2);
add('Insert', 'Ins', 15.25, 1.5); add('Home', 'Home', 16.25, 1.5); add('PageUp', 'PgUp', 17.25, 1.5);

add('Tab', 'Tab', 0, 2.5, 1.5);
'QWERTYUIOP'.split('').forEach((l, i) => add('Key' + l, l, 1.5 + i, 2.5));
add('BracketLeft', '[', 11.5, 2.5); add('BracketRight', ']', 12.5, 2.5); add('Backslash', '\\', 13.5, 2.5, 1.5);
add('Delete', 'Del', 15.25, 2.5); add('End', 'End', 16.25, 2.5); add('PageDown', 'PgDn', 17.25, 2.5);

add('CapsLock', 'Caps', 0, 3.5, 1.75);
'ASDFGHJKL'.split('').forEach((l, i) => add('Key' + l, l, 1.75 + i, 3.5));
add('Semicolon', ';', 10.75, 3.5); add('Quote', "'", 11.75, 3.5); add('Enter', 'Enter', 12.75, 3.5, 2.25);

add('ShiftLeft', 'Shift', 0, 4.5, 2.25);
'ZXCVBNM'.split('').forEach((l, i) => add('Key' + l, l, 2.25 + i, 4.5));
add('Comma', ',', 9.25, 4.5); add('Period', '.', 10.25, 4.5); add('Slash', '/', 11.25, 4.5);
add('ShiftRight', 'Shift', 12.25, 4.5, 2.75);
add('ArrowUp', '↑', 16.25, 4.5);

add('ControlLeft', 'Ctrl', 0, 5.5, 1.25); add('MetaLeft', 'Super', 1.25, 5.5, 1.25); add('AltLeft', 'Alt', 2.5, 5.5, 1.25);
add('Space', 'TECLAB', 3.75, 5.5, 6.25);
add('AltRight', 'Alt', 10, 5.5, 1.25); add('Fn', 'Fn', 11.25, 5.5, 1.25);
add('ContextMenu', 'Menu', 12.5, 5.5, 1.25); add('ControlRight', 'Ctrl', 13.75, 5.5, 1.25);
add('ArrowLeft', '←', 15.25, 5.5); add('ArrowDown', '↓', 16.25, 5.5); add('ArrowRight', '→', 17.25, 5.5);

export const KEYS = K;
export const WIDTH_MM = COLS * U + BEZEL * 2;
export const DEPTH_MM = ROWS * U + BEZEL * 2;
