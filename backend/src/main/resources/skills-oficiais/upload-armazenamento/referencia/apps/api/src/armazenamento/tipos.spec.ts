// origem: skills-modelo/apps/api/src/armazenamento/tipos.spec.ts
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { validarTipo } from './tipos';

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(40, 0x20)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)]);

async function xlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Dados').addRow(['a', 'b']);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** ZIP mínimo só com cabeçalhos de entrada (sem compressão): basta para o teste de nomes das entradas. */
function zip(...nomes: string[]): Buffer {
  const partes = nomes.map((nome) => {
    const n = Buffer.from(nome);
    const cab = Buffer.alloc(30);
    cab.writeUInt32LE(0x04034b50, 0);
    cab.writeUInt16LE(n.length, 26);
    return Buffer.concat([cab, n, Buffer.from('x')]);
  });
  return Buffer.concat(partes);
}

describe('validarTipo (assinatura de bytes)', () => {
  it('reconhece PDF, PNG, JPEG e XLSX pelo conteúdo', async () => {
    expect(validarTipo(PDF)?.mime).toBe('application/pdf');
    expect(validarTipo(PNG)?.mime).toBe('image/png');
    expect(validarTipo(JPEG)?.mime).toBe('image/jpeg');
    const planilha = validarTipo(await xlsx());
    expect(planilha?.mime).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(planilha?.extensao).toBe('xlsx');
  });

  it('executável (MZ), script, HTML, SVG e texto não passam, qualquer que seja o nome', () => {
    expect(validarTipo(Buffer.from('MZ\x90\x00\x03\x00\x00\x00'))).toBeNull();
    expect(validarTipo(Buffer.from('#!/bin/sh\nrm -rf /'))).toBeNull();
    expect(validarTipo(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(validarTipo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(validarTipo(Buffer.from('%PDF'))).toBeNull(); // curto demais: sem a versão
    expect(validarTipo(Buffer.alloc(0))).toBeNull();
  });

  it('ZIP que não é planilha (docx, zip comum, macro) é recusado; ZIP com a assinatura de planilha passa', () => {
    expect(validarTipo(zip('[Content_Types].xml', 'word/document.xml'))).toBeNull();
    expect(validarTipo(zip('arquivo.txt'))).toBeNull();
    expect(validarTipo(zip('[Content_Types].xml', 'xl/workbook.xml', 'xl/vbaProject.bin'))).toBeNull();
    expect(validarTipo(zip('xl/workbook.xml', '[Content_Types].xml'))).toBeNull(); // 1ª entrada tem de ser [Content_Types].xml
    expect(validarTipo(zip('[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml'))?.extensao).toBe('xlsx');
  });

  it('respeita a lista de tipos permitidos', () => {
    expect(validarTipo(PNG, ['pdf', 'jpg'])).toBeNull();
    expect(validarTipo(PDF, ['pdf'])?.extensao).toBe('pdf');
  });
});
