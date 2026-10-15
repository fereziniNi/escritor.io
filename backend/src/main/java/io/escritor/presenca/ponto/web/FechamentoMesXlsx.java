package io.escritor.presenca.ponto.web;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/**
 * Pedido do usuário: "deixe a tabela bonita, bem apresentável, agradável de se ver" - CSV não
 * guarda formatação, então o fechamento mensal sai em Excel: título com o mês, cabeçalho colorido
 * com filtro e congelado, linhas zebradas, saldo verde (sobrando) ou vermelho (faltando) e linha
 * de total da equipe, nas cores do sistema (`index.css`). Horas trabalhadas vão como valor de tempo de verdade (`[h]:mm`), então dá
 * pra somar no Excel; o saldo vai como texto com sinal porque o Excel não exibe tempo negativo.
 */
public final class FechamentoMesXlsx {

    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    private static final List<String> CABECALHO = List.of(
            "Pessoa", "Carga diária", "Dias trabalhados", "Horas trabalhadas", "Saldo", "Dias úteis sem marcação", "Dias inconsistentes");
    private static final int[] LARGURAS = {30, 14, 18, 20, 14, 26, 21};

    private static final String COR_PRIMARIA = "4F8F6F";
    private static final String COR_TITULO = "3A6D53";
    private static final String COR_ZEBRA = "FAF8F1";
    private static final String COR_BORDA = "E6E1D0";
    private static final String COR_TOTAL = "E4F3EC";
    private static final String COR_POSITIVO_FUNDO = "E4F3EC";
    private static final String COR_POSITIVO_TEXTO = "3A6D53";
    private static final String COR_NEGATIVO_FUNDO = "FDECE7";
    private static final String COR_NEGATIVO_TEXTO = "B8432C";
    private static final String COR_ALERTA_TEXTO = "CF7F1F";
    private static final String COR_NOTA = "6B6B7D";

    private static final int LINHA_TITULO = 0;
    private static final int LINHA_NOTA = 1;
    private static final int LINHA_CABECALHO = 3;

    private FechamentoMesXlsx() {
    }

    public static byte[] gerar(FechamentoMesResponse fechamento) {
        try (XSSFWorkbook planilha = new XSSFWorkbook(); ByteArrayOutputStream saida = new ByteArrayOutputStream()) {
            new Montagem(planilha).montar(fechamento);
            planilha.write(saida);
            return saida.toByteArray();
        } catch (IOException erro) {
            throw new UncheckedIOException(erro);
        }
    }

    /** "2026-10" -> "Outubro/2026". */
    static String nomeDoMes(String mes) {
        YearMonth anoMes = YearMonth.parse(mes);
        String nome = anoMes.getMonth().getDisplayName(TextStyle.FULL, PT_BR);
        return Character.toUpperCase(nome.charAt(0)) + nome.substring(1) + "/" + anoMes.getYear();
    }

    static String saldo(long minutos) {
        long absoluto = Math.abs(minutos);
        return (minutos < 0 ? "-" : "+") + (absoluto / 60) + ":" + String.format("%02d", absoluto % 60);
    }

    /** Estilos são por planilha no POI - um objeto por geração guarda os que são reaproveitados. */
    private static final class Montagem {

        private final XSSFWorkbook planilha;
        private final short formatoHoras;

        Montagem(XSSFWorkbook planilha) {
            this.planilha = planilha;
            this.formatoHoras = planilha.createDataFormat().getFormat("[h]:mm");
        }

        void montar(FechamentoMesResponse fechamento) {
            XSSFSheet aba = planilha.createSheet("Fechamento " + fechamento.mes());
            aba.setDisplayGridlines(false);
            for (int coluna = 0; coluna < LARGURAS.length; coluna++) {
                aba.setColumnWidth(coluna, LARGURAS[coluna] * 256);
            }

            escreverTitulo(aba, fechamento.mes());
            escreverCabecalho(aba);

            List<FechamentoMesPessoaResponse> pessoas = fechamento.pessoas();
            for (int indice = 0; indice < pessoas.size(); indice++) {
                escreverPessoa(aba, LINHA_CABECALHO + 1 + indice, pessoas.get(indice), indice % 2 == 1);
            }
            escreverTotal(aba, LINHA_CABECALHO + 1 + pessoas.size(), pessoas);

            aba.createFreezePane(1, LINHA_CABECALHO + 1);
            if (!pessoas.isEmpty()) {
                aba.setAutoFilter(new CellRangeAddress(LINHA_CABECALHO, LINHA_CABECALHO + pessoas.size(), 0, CABECALHO.size() - 1));
            }
            aba.getPrintSetup().setLandscape(true);
            aba.setFitToPage(true);
            aba.getPrintSetup().setFitWidth((short) 1);
            aba.getPrintSetup().setFitHeight((short) 0);
        }

        private void escreverTitulo(XSSFSheet aba, String mes) {
            Row titulo = aba.createRow(LINHA_TITULO);
            titulo.setHeightInPoints(34);
            XSSFCellStyle estiloTitulo = estilo(fonte(18, true, COR_TITULO), null, HorizontalAlignment.LEFT, false);
            Cell celulaTitulo = titulo.createCell(0);
            celulaTitulo.setCellValue("Fechamento de horas · " + nomeDoMes(mes));
            celulaTitulo.setCellStyle(estiloTitulo);
            aba.addMergedRegion(new CellRangeAddress(LINHA_TITULO, LINHA_TITULO, 0, CABECALHO.size() - 1));

            Row nota = aba.createRow(LINHA_NOTA);
            nota.setHeightInPoints(18);
            XSSFFont fonteNota = fonte(10, false, COR_NOTA);
            fonteNota.setItalic(true);
            Cell celulaNota = nota.createCell(0);
            celulaNota.setCellValue(
                    "Saldo = horas de cada dia útil marcado − carga diária. Dias úteis sem nenhuma marcação aparecem à parte e não entram no saldo.");
            celulaNota.setCellStyle(estilo(fonteNota, null, HorizontalAlignment.LEFT, false));
            aba.addMergedRegion(new CellRangeAddress(LINHA_NOTA, LINHA_NOTA, 0, CABECALHO.size() - 1));
        }

        private void escreverCabecalho(XSSFSheet aba) {
            Row cabecalho = aba.createRow(LINHA_CABECALHO);
            cabecalho.setHeightInPoints(30);
            XSSFCellStyle estiloPessoa = estilo(fonte(11, true, "FFFFFF"), COR_PRIMARIA, HorizontalAlignment.LEFT, true);
            XSSFCellStyle estiloDemais = estilo(fonte(11, true, "FFFFFF"), COR_PRIMARIA, HorizontalAlignment.CENTER, true);
            estiloPessoa.setWrapText(true);
            estiloDemais.setWrapText(true);
            for (int coluna = 0; coluna < CABECALHO.size(); coluna++) {
                Cell celula = cabecalho.createCell(coluna);
                celula.setCellValue(CABECALHO.get(coluna));
                celula.setCellStyle(coluna == 0 ? estiloPessoa : estiloDemais);
            }
        }

        private void escreverPessoa(XSSFSheet aba, int linha, FechamentoMesPessoaResponse pessoa, boolean zebrada) {
            Row row = aba.createRow(linha);
            row.setHeightInPoints(22);
            String fundo = zebrada ? COR_ZEBRA : "FFFFFF";

            texto(row, 0, pessoa.nome(), estilo(fonte(11, true, "2B2B3A"), fundo, HorizontalAlignment.LEFT, true));
            horas(row, 1, pessoa.cargaDiariaMinutos(), estiloHoras(fonte(11, false, "2B2B3A"), fundo));
            numero(row, 2, pessoa.diasTrabalhados(), estilo(fonte(11, false, "2B2B3A"), fundo, HorizontalAlignment.CENTER, true));
            horas(row, 3, pessoa.minutosTrabalhados(), estiloHoras(fonte(11, true, "2B2B3A"), fundo));
            celulaSaldo(row, 4, pessoa.saldoMinutos(), false);
            numero(row, 5, pessoa.diasUteisSemMarcacao(), estiloContagemComAlerta(pessoa.diasUteisSemMarcacao(), fundo));
            numero(row, 6, pessoa.diasInconsistentes(), estiloContagemComAlerta(pessoa.diasInconsistentes(), fundo));
        }

        private void escreverTotal(XSSFSheet aba, int linha, List<FechamentoMesPessoaResponse> pessoas) {
            Row row = aba.createRow(linha);
            row.setHeightInPoints(26);
            XSSFFont fonteTotal = fonte(11, true, COR_TITULO);

            XSSFCellStyle estiloRotulo = estilo(fonteTotal, COR_TOTAL, HorizontalAlignment.LEFT, true);
            estiloRotulo.setBorderTop(BorderStyle.MEDIUM);
            estiloRotulo.setTopBorderColor(cor(COR_PRIMARIA));
            XSSFCellStyle estiloNumero = estilo(fonteTotal, COR_TOTAL, HorizontalAlignment.CENTER, true);
            estiloNumero.setBorderTop(BorderStyle.MEDIUM);
            estiloNumero.setTopBorderColor(cor(COR_PRIMARIA));
            XSSFCellStyle estiloHorasTotal = estiloHoras(fonteTotal, COR_TOTAL);
            estiloHorasTotal.setBorderTop(BorderStyle.MEDIUM);
            estiloHorasTotal.setTopBorderColor(cor(COR_PRIMARIA));

            texto(row, 0, "Total da equipe", estiloRotulo);
            texto(row, 1, "", estiloNumero);
            numero(row, 2, pessoas.stream().mapToInt(FechamentoMesPessoaResponse::diasTrabalhados).sum(), estiloNumero);
            horas(row, 3, pessoas.stream().mapToLong(FechamentoMesPessoaResponse::minutosTrabalhados).sum(), estiloHorasTotal);
            celulaSaldo(row, 4, pessoas.stream().mapToLong(FechamentoMesPessoaResponse::saldoMinutos).sum(), true);
            numero(row, 5, pessoas.stream().mapToInt(FechamentoMesPessoaResponse::diasUteisSemMarcacao).sum(), estiloNumero);
            numero(row, 6, pessoas.stream().mapToInt(FechamentoMesPessoaResponse::diasInconsistentes).sum(), estiloNumero);
        }

        private void celulaSaldo(Row row, int coluna, long minutos, boolean total) {
            boolean negativo = minutos < 0;
            XSSFCellStyle estiloSaldo = estilo(
                    fonte(11, true, negativo ? COR_NEGATIVO_TEXTO : COR_POSITIVO_TEXTO),
                    negativo ? COR_NEGATIVO_FUNDO : COR_POSITIVO_FUNDO,
                    HorizontalAlignment.CENTER,
                    true);
            if (total) {
                estiloSaldo.setBorderTop(BorderStyle.MEDIUM);
                estiloSaldo.setTopBorderColor(cor(COR_PRIMARIA));
            }
            texto(row, coluna, saldo(minutos), estiloSaldo);
        }

        private XSSFCellStyle estiloContagemComAlerta(int quantidade, String fundo) {
            return quantidade > 0
                    ? estilo(fonte(11, true, COR_ALERTA_TEXTO), fundo, HorizontalAlignment.CENTER, true)
                    : estilo(fonte(11, false, "B4B0A2"), fundo, HorizontalAlignment.CENTER, true);
        }

        private XSSFCellStyle estiloHoras(XSSFFont fonte, String fundo) {
            XSSFCellStyle estilo = estilo(fonte, fundo, HorizontalAlignment.CENTER, true);
            estilo.setDataFormat(formatoHoras);
            return estilo;
        }

        private XSSFCellStyle estilo(XSSFFont fonte, String fundo, HorizontalAlignment alinhamento, boolean bordas) {
            XSSFCellStyle estilo = planilha.createCellStyle();
            estilo.setFont(fonte);
            estilo.setAlignment(alinhamento);
            estilo.setVerticalAlignment(VerticalAlignment.CENTER);
            estilo.setIndention(alinhamento == HorizontalAlignment.LEFT && bordas ? (short) 1 : (short) 0);
            if (fundo != null) {
                estilo.setFillForegroundColor(cor(fundo));
                estilo.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            }
            if (bordas) {
                estilo.setBorderBottom(BorderStyle.THIN);
                estilo.setBottomBorderColor(cor(COR_BORDA));
                estilo.setBorderTop(BorderStyle.THIN);
                estilo.setTopBorderColor(cor(COR_BORDA));
                estilo.setBorderLeft(BorderStyle.THIN);
                estilo.setLeftBorderColor(cor(COR_BORDA));
                estilo.setBorderRight(BorderStyle.THIN);
                estilo.setRightBorderColor(cor(COR_BORDA));
            }
            return estilo;
        }

        private XSSFFont fonte(int tamanho, boolean negrito, String corHex) {
            XSSFFont fonte = planilha.createFont();
            fonte.setFontName("Calibri");
            fonte.setFontHeightInPoints((short) tamanho);
            fonte.setBold(negrito);
            fonte.setColor(cor(corHex));
            return fonte;
        }

        private static XSSFColor cor(String hex) {
            return new XSSFColor(new byte[] {
                    (byte) Integer.parseInt(hex.substring(0, 2), 16),
                    (byte) Integer.parseInt(hex.substring(2, 4), 16),
                    (byte) Integer.parseInt(hex.substring(4, 6), 16)}, null);
        }

        private static void texto(Row row, int coluna, String valor, XSSFCellStyle estilo) {
            Cell celula = row.createCell(coluna);
            celula.setCellValue(valor);
            celula.setCellStyle(estilo);
        }

        private static void numero(Row row, int coluna, long valor, XSSFCellStyle estilo) {
            Cell celula = row.createCell(coluna);
            celula.setCellValue(valor);
            celula.setCellStyle(estilo);
        }

        /** Excel guarda tempo como fração de dia - `[h]:mm` mostra passando de 24h ("161:30"). */
        private static void horas(Row row, int coluna, long minutos, XSSFCellStyle estilo) {
            Cell celula = row.createCell(coluna);
            celula.setCellValue(minutos / 1440.0);
            celula.setCellStyle(estilo);
        }
    }
}
