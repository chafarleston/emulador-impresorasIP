# Thermal Printer Emulator

Emulador de impresora térmica IP con soporte completo de comandos ESC/POS. Escucha en un puerto TCP raw y muestra el resultado en una interfaz gráfica que simula el papel térmico.

## Características

- **Servidor TCP raw** en puerto 9100 (estándar Epson) con fallo automático a puertos siguientes
- **Soporte ESC/POS**: negrita, doble altura, doble ancho, subrayado, alineación (izquierda/centro/derecha)
- **Códigos de barras** (Code39) y **códigos QR**
- **Corte de papel** simulado
- **IP configurable**: vincular a cualquier interfaz de red del equipo
- **Idioma**: Español / English (seleccionable desde el panel)
- **Configuración persistente** en `config.json` (en la misma carpeta del ejecutable)
- **Portátil**: no requiere Node.js ni instalación de dependencias

## Requisitos para desarrollo

- Node.js 18+
- Yarn o npm

## Instalación y ejecución (desarrollo)

```bash
cd thermal-printer-emulator
yarn install
yarn start
```

Con IP específica:
```bash
yarn start --ip 192.168.1.100
```

## Compilar a .exe

```bash
yarn build
```

El ejecutable se genera en:
```
dist/thermal-printer-emulator-win32-x64/thermal-printer-emulator.exe
```

## Archivo de configuración

Se crea automáticamente al guardar desde el panel de configuración:

```json
{
  "ip": "0.0.0.0",
  "port": 9100,
  "language": "es"
}
```

Puedes editarlo manualmente con la app cerrada.

## Comandos ESC/POS soportados

| Comando | Descripción |
|---------|-------------|
| `0x0A` | Avance de línea |
| `0x0D` | Retorno de carro |
| `0x1B 0x40` | Inicializar impresora |
| `0x1B 0x21 n` | Modo de impresión (negrita, doble altura, doble ancho) |
| `0x1B 0x45 n` | Negrita on/off |
| `0x1B 0x61 n` | Alineación (0=izq, 1=centro, 2=der) |
| `0x1B 0x64 n` | Avanzar n líneas |
| `0x1D 0x56 n` | Corte de papel |
| `0x1D 0x68 n` | Altura de código de barras |
| `0x1D 0x6B m d1...dk 0x00` | Código de barras Code39 |
| `0x1D 0x28 0x6B ...` | Código QR |

## Estructura del proyecto

```
thermal-printer-emulator/
├── main.js            # Proceso principal (servidor TCP, IPC, menú)
├── preload.js         # Bridge seguro main ↔ renderer
├── renderer.js        # Lógica de la interfaz gráfica
├── index.html         # Interfaz de usuario
├── i18n.js            # Traducciones ES/EN
├── escpos-parser.js   # Parser de comandos ESC/POS
├── config.json        # Configuración persistente
├── package.json       # Dependencias y scripts
└── dist/              # Ejecutable compilado
```

## Licencia

MIT
