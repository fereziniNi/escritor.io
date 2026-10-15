package io.escritor.presenca.ponto.web;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.List;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FechamentoMesXlsxTest {

    private static final FechamentoMesResponse FECHAMENTO = new FechamentoMesResponse("2026-10", List.of(
            new FechamentoMesPessoaResponse(1L, "Ana Souza", 480, 10, 4805, 5, 0, 0),
            new FechamentoMesPessoaResponse(2L, "Nícolas", 360, 9, 3150, -90, 2, 1)));

    private static Sheet abrir(FechamentoMesResponse fechamento) throws IOException {
        return new XSSFWorkbook(new ByteArrayInputStream(FechamentoMesXlsx.gerar(fechamento))).getSheetAt(0);
    }

    @Test
    void tituloTemONomeDoMesPorExtenso() throws IOException {
        Sheet aba = abrir(FECHAMENTO);

        assertThat(aba.getRow(0).getCell(0).getStringCellValue()).isEqualTo("Fechamento de horas · Outubro/2026");
        assertThat(aba.getRow(3).getCell(0).getStringCellValue()).isEqualTo("Pessoa");
        assertThat(aba.getRow(3).getCell(4).getStringCellValue()).isEqualTo("Saldo");
    }

    @Test
    void umaLinhaPorPessoaComHorasComoTempoESaldoComSinal() throws IOException {
        Sheet aba = abrir(FECHAMENTO);
        Row ana = aba.getRow(4);
        Row nicolas = aba.getRow(5);

        assertThat(ana.getCell(0).getStringCellValue()).isEqualTo("Ana Souza");
        assertThat(ana.getCell(1).getNumericCellValue()).isEqualTo(480 / 1440.0);
        assertThat(ana.getCell(3).getNumericCellValue()).isEqualTo(4805 / 1440.0);
        assertThat(ana.getCell(3).getCellStyle().getDataFormatString()).isEqualTo("[h]:mm");
        assertThat(ana.getCell(4).getStringCellValue()).isEqualTo("+0:05");

        assertThat(nicolas.getCell(0).getStringCellValue()).isEqualTo("Nícolas");
        assertThat(nicolas.getCell(4).getStringCellValue()).isEqualTo("-1:30");
        assertThat(nicolas.getCell(5).getNumericCellValue()).isEqualTo(2);
        assertThat(nicolas.getCell(6).getNumericCellValue()).isEqualTo(1);
    }

    @Test
    void saldoNegativoEmVermelhoEPositivoEmVerde() throws IOException {
        Sheet aba = abrir(FECHAMENTO);

        XSSFCellStyle positivo = (XSSFCellStyle) aba.getRow(4).getCell(4).getCellStyle();
        XSSFCellStyle negativo = (XSSFCellStyle) aba.getRow(5).getCell(4).getCellStyle();

        assertThat(positivo.getFont().getXSSFColor().getARGBHex()).endsWith("3A6D53");
        assertThat(negativo.getFont().getXSSFColor().getARGBHex()).endsWith("B8432C");
    }

    @Test
    void ultimaLinhaSomaAEquipe() throws IOException {
        Row total = abrir(FECHAMENTO).getRow(6);

        assertThat(total.getCell(0).getStringCellValue()).isEqualTo("Total da equipe");
        assertThat(total.getCell(2).getNumericCellValue()).isEqualTo(19);
        assertThat(total.getCell(3).getNumericCellValue()).isEqualTo((4805 + 3150) / 1440.0);
        assertThat(total.getCell(4).getStringCellValue()).isEqualTo("-1:25");
    }

    @Test
    void mesSemPessoasAindaGeraPlanilhaComTotalZerado() throws IOException {
        Row total = abrir(new FechamentoMesResponse("2026-01", List.of())).getRow(4);

        assertThat(total.getCell(0).getStringCellValue()).isEqualTo("Total da equipe");
        assertThat(total.getCell(4).getStringCellValue()).isEqualTo("+0:00");
    }
}
