/**
 * Shared export utilities for CSV and PDF downloads.
 */

/**
 * Download an array of flat objects as a CSV file.
 * Column order is determined by the keys of the first object.
 */
export function downloadCSV(
  data: Record<string, unknown>[],
  filename: string,
) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val == null) return "";
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(","),
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download an array of flat objects as a PDF table.
 * Uses dynamic imports to keep jsPDF out of the initial page bundle.
 */
export async function downloadPDF(
  data: Record<string, unknown>[],
  filename: string,
  title?: string,
) {
  if (!data.length) return;

  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Title
  if (title) {
    doc.setFontSize(14);
    doc.text(title, 14, 15);
  }

  const headers = Object.keys(data[0]);
  const body = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val == null) return "";
      return String(val);
    }),
  );

  autoTable(doc, {
    head: [headers],
    body,
    startY: title ? 22 : 10,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 10, right: 10 },
  });

  doc.save(filename);
}
