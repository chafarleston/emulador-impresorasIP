const { ipcMain } = require('electron');

class ESCPOSParser {
  constructor() {
    this.buffer = [];
    this.state = 'IDLE';
    this.commandBytes = [];
    this.currentLine = { text: [], styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } };
    this.lines = [];
    this.barcodeHeight = 50;
    this.barcodeWidth = 2;
    this.charTable = 0;
  }

  reset() {
    this.buffer = [];
    this.state = 'IDLE';
    this.commandBytes = [];
    this.currentLine = { text: [], styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } };
    this.lines = [];
  }

  flushLine() {
    if (this.currentLine.text.length > 0 || this.lines.length === 0 || this.lines[this.lines.length - 1].type !== 'text') {
      const lineText = this.currentLine.text.join('');
      this.lines.push({ type: 'text', content: lineText, styles: { ...this.currentLine.styles } });
    }
  }

  feedLines(n) {
    this.flushLine();
    for (let i = 0; i < n; i++) {
      this.lines.push({ type: 'text', content: '', styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } });
    }
    this.currentLine = { text: [], styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } };
  }

  processByte(byte) {
    switch (this.state) {
      case 'IDLE':
        if (byte === 0x0A) {
          this.flushLine();
          this.lines.push({ type: 'text', content: '', styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } });
          this.currentLine = { text: [], styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } };
        } else if (byte === 0x0D) {
        } else if (byte === 0x1B) {
          this.state = 'ESC';
        } else if (byte === 0x1D) {
          this.state = 'GS';
        } else if (byte >= 0x20) {
          this.currentLine.text.push(String.fromCharCode(byte));
        }
        break;

      case 'ESC':
        switch (byte) {
          case 0x40:
            this.reset();
            break;
          case 0x21:
            this.state = 'ESC_PRINT_MODE';
            break;
          case 0x45:
            this.state = 'ESC_BOLD';
            break;
          case 0x61:
            this.state = 'ESC_ALIGN';
            break;
          case 0x64:
            this.state = 'ESC_FEED';
            break;
          case 0x32:
            this.currentLine.styles = { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 };
            this.state = 'IDLE';
            break;
          case 0x33:
            this.state = 'ESC_LINE_SPACING';
            break;
          case 0x74:
            this.state = 'ESC_CHAR_TABLE';
            break;
          case 0x63:
            this.state = 'ESC_C';
            break;
          default:
            this.state = 'IDLE';
        }
        break;

      case 'ESC_PRINT_MODE':
        {
          const n = byte;
          this.currentLine.styles.bold = !!(n & 0x08);
          this.currentLine.styles.doubleH = !!(n & 0x10);
          this.currentLine.styles.doubleW = !!(n & 0x20);
          this.currentLine.styles.underline = !!(n & 0x80);
          this.state = 'IDLE';
        }
        break;

      case 'ESC_BOLD':
        this.currentLine.styles.bold = byte === 1;
        this.state = 'IDLE';
        break;

      case 'ESC_ALIGN':
        this.currentLine.styles.align = byte <= 2 ? byte : 0;
        this.state = 'IDLE';
        break;

      case 'ESC_FEED':
        this.feedLines(byte || 1);
        this.state = 'IDLE';
        break;

      case 'ESC_LINE_SPACING':
        this.state = 'IDLE';
        break;

      case 'ESC_CHAR_TABLE':
        this.charTable = byte;
        this.state = 'IDLE';
        break;

      case 'ESC_C':
        if (byte === 0x30) {
          this.state = 'ESC_C_0';
        } else {
          this.state = 'IDLE';
        }
        break;

      case 'ESC_C_0':
        this.state = 'IDLE';
        break;

      case 'GS':
        switch (byte) {
          case 0x56:
            this.state = 'GS_CUT';
            break;
          case 0x68:
            this.state = 'GS_BARCODE_H';
            break;
          case 0x77:
            this.state = 'GS_BARCODE_W';
            break;
          case 0x6B:
            this.state = 'GS_BARCODE';
            this.commandBytes = [];
            break;
          case 0x28:
            this.state = 'GS_QR';
            this.commandBytes = [];
            break;
          case 0x4C:
            this.state = 'GS_MARGIN';
            break;
          case 0x53:
            this.state = 'IDLE';
            break;
          default:
            this.state = 'IDLE';
        }
        break;

      case 'GS_CUT':
        this.flushLine();
        this.lines.push({ type: 'cut', content: byte === 0x31 ? 'cut-full' : 'cut-partial' });
        this.state = 'IDLE';
        break;

      case 'GS_BARCODE_H':
        this.barcodeHeight = byte;
        this.state = 'IDLE';
        break;

      case 'GS_BARCODE_W':
        this.barcodeWidth = byte;
        this.state = 'IDLE';
        break;

      case 'GS_BARCODE':
        if (this.commandBytes.length === 0) {
          this.commandBytes.push(byte);
        } else {
          const m = this.commandBytes[0];
          if (byte === 0x00) {
            const data = Buffer.from(this.commandBytes.slice(1));
            const code = data.toString('ascii');
            this.flushLine();
            this.lines.push({ type: 'barcode', content: code, format: m, height: this.barcodeHeight, width: this.barcodeWidth });
            this.currentLine = { text: [], styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } };
            this.state = 'IDLE';
          } else {
            this.commandBytes.push(byte);
          }
        }
        break;

      case 'GS_QR':
        this.commandBytes.push(byte);
        if (this.commandBytes.length >= 4) {
          const pL = this.commandBytes[0];
          const pH = this.commandBytes[1];
          const cn = this.commandBytes[2];
          const fn = this.commandBytes[3];
          const dataLen = pL + (pH << 8);
          if (this.commandBytes.length === 4 && (fn === 0x50 || fn === 0x51 || fn === 0x52)) {
            this.state = 'GS_QR_DATA';
            this.qrExpectedLen = fn === 0x50 ? 3 : (fn === 0x51 ? 4 : dataLen - 4);
            this.qrFn = fn;
          } else if (this.commandBytes.length === dataLen + 2) {
            this.state = 'IDLE';
          }
        }
        break;

      case 'GS_QR_DATA':
        this.commandBytes.push(byte);
        if (this.commandBytes.length >= this.qrExpectedLen + 4) {
          const data = Buffer.from(this.commandBytes.slice(4));
          const text = data.toString('ascii').replace(/\0+$/, '');
          this.flushLine();
          this.lines.push({ type: 'qrcode', content: text });
          this.currentLine = { text: [], styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } };
          this.state = 'IDLE';
        }
        break;

      case 'GS_MARGIN':
        this.state = 'IDLE';
        break;
    }
  }

  feed(data) {
    for (const byte of data) {
      this.processByte(byte);
    }
  }

  getOutput() {
    this.flushLine();
    const output = [...this.lines];
    this.lines = [];
    this.currentLine = { text: [], styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } };
    return output;
  }
}

module.exports = { ESCPOSParser };
