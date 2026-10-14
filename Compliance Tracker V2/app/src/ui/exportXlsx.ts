/* Every "Export" button in the product downloads a real workbook, not a bare
   CSV — a bold, teal header row (the same accent used everywhere else in the
   product) frozen in place, and columns sized to their content, so the file
   opens in Excel already readable rather than a wall of unstyled text. */

import ExcelJS from "exceljs";

export async function exportXlsx({
  filename, headers, rows, sheetName = "Sheet1",
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  sheetName?: string;
}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);

  const header = ws.getRow(1);
  header.height = 20;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B6E63" } };
    cell.alignment = { vertical: "middle" };
  });

  headers.forEach((h, i) => {
    const longest = rows.reduce((max, r) => Math.max(max, String(r[i] ?? "").length), h.length);
    ws.getColumn(i + 1).width = Math.min(42, Math.max(10, longest + 2));
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
