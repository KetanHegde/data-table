import { useState, useMemo, useRef } from "react";
import "./DataTable.css";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

const DataTable = ({
  data: initialData,
  columns: initialColumns,
  itemsPerPage = 10,
}) => {
  const [data, setData] = useState(initialData || []);
  const [columns, setColumns] = useState(initialColumns || []);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [globalFilter, setGlobalFilter] = useState("");
  const [visibleColumns, setVisibleColumns] = useState(
    initialColumns?.reduce((acc, col) => ({ ...acc, [col.key]: true }), {}) ||
      {}
  );
  const [showColumnControls, setShowColumnControls] = useState(false);
  const fileInputRef = useRef(null);

  // Global filter - searches across all columns
  const filteredData = useMemo(() => {
    if (!globalFilter) return data;

    return data.filter((item) => {
      return Object.values(item).some((value) => {
        if (value === null || value === undefined) return false;
        return value
          .toString()
          .toLowerCase()
          .includes(globalFilter.toLowerCase());
      });
    });
  }, [data, globalFilter]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === bVal) return 0;
      const result = aVal > bVal ? 1 : -1;
      return sortConfig.direction === "desc" ? -result : result;
    });
  }, [filteredData, sortConfig]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const handleSort = (key) => {
    setSortConfig((prevConfig) => ({
      key,
      direction:
        prevConfig.key === key && prevConfig.direction === "asc"
          ? "desc"
          : "asc",
    }));
  };

  const toggleColumnVisibility = (key) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearGlobalFilter = () => {
    setGlobalFilter("");
    setCurrentPage(1);
  };

  const formatCellValue = (value, type) => {
    if (value === null || value === undefined) return "";

    switch (type) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(value);
      case "date":
        return new Date(value).toLocaleDateString();
      default:
        return value;
    }
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return "↕️";
    return sortConfig.direction === "asc" ? "▲" : "▼";
  };

  // Replace the handleFileUpload function
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split(".").pop().toLowerCase();

    if (fileExtension === "csv") {
      // Handle CSV files (existing logic)
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split("\n").filter((line) => line.trim() !== "");

        if (lines.length === 0) {
          toast("Uploaded file is empty", {
            icon: "❌",
          });
          return;
        }

        // Parse header row
        const headers = lines[0]
          .split(",")
          .map((header) => header.trim().replace(/"/g, ""));

        // Create column config
        const newColumns = headers.map((header) => ({
          key: header.toLowerCase().replace(/\s+/g, "_"),
          label: header,
          sortable: true,
          filterable: true,
          type: "string",
        }));

        // Parse data rows
        const newData = lines.slice(1).map((line, index) => {
          const values = line
            .split(",")
            .map((value) => value.trim().replace(/"/g, ""));
          const row = { id: index + 1 };

          headers.forEach((header, i) => {
            const key = header.toLowerCase().replace(/\s+/g, "_");
            let value = values[i] || "";

            // Try to detect data types and convert
            if (!isNaN(value) && !isNaN(parseFloat(value)) && value !== "") {
              value = parseFloat(value);
              newColumns[i].type = "number";
            } else if (
              value.match(/^\d{4}-\d{2}-\d{2}$/) ||
              value.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
            ) {
              newColumns[i].type = "date";
            } else if (value.startsWith("$") || value.match(/^\d+\.\d{2}$/)) {
              value = parseFloat(value.replace("$", ""));
              newColumns[i].type = "currency";
            }

            row[key] = value;
          });

          return row;
        });

        updateTableData(newColumns, newData);
      };
      reader.readAsText(file);
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      // Handle Excel files
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          // Get the first worksheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length === 0) {
            toast("Uploaded file is empty", {
              icon: "❌",
            });
            return;
          }

          // Get headers from first row
          const headers = jsonData[0].map((header) =>
            header
              ? header.toString().trim()
              : `Column_${Math.random().toString(36).substr(2, 9)}`
          );

          // Create column config
          const newColumns = headers.map((header) => ({
            key: header.toLowerCase().replace(/\s+/g, "_"),
            label: header,
            sortable: true,
            filterable: true,
            type: "string",
          }));

          // Parse data rows
          const newData = jsonData.slice(1).map((row, index) => {
            const rowData = { id: index + 1 };

            headers.forEach((header, i) => {
              const key = header.toLowerCase().replace(/\s+/g, "_");
              let value = row[i] || "";

              // Convert value to string for processing
              value = value.toString().trim();

              // Try to detect data types and convert
              if (!isNaN(value) && !isNaN(parseFloat(value)) && value !== "") {
                value = parseFloat(value);
                newColumns[i].type = "number";
              } else if (
                value.match(/^\d{4}-\d{2}-\d{2}$/) ||
                value.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
              ) {
                newColumns[i].type = "date";
              } else if (value.startsWith("$") || value.match(/^\d+\.\d{2}$/)) {
                value = parseFloat(value.replace("$", ""));
                newColumns[i].type = "currency";
              }

              rowData[key] = value;
            });

            return rowData;
          });

          updateTableData(newColumns, newData);
        } catch (error) {
          console.error("Error reading Excel file:", error);
          alert(
            "Error reading Excel file. Please make sure it's a valid Excel file."
          );
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert("Please upload a CSV or Excel file (.csv, .xlsx, .xls)");
      return;
    }
  };

  // Helper function to update table data
  const updateTableData = (newColumns, newData) => {
    setColumns(newColumns);
    setData(newData);
    setVisibleColumns(
      newColumns.reduce((acc, col) => ({ ...acc, [col.key]: true }), {})
    );
    setCurrentPage(1);
    setGlobalFilter("");
    setSortConfig({ key: null, direction: "asc" });
  };

  // Download as CSV
  const downloadAsExcel = () => {
    const visibleColumnsArray = columns.filter(
      (col) => visibleColumns[col.key]
    );

    // Create CSV content
    const headers = visibleColumnsArray.map((col) => col.label).join(",");
    const rows = sortedData.map((item) =>
      visibleColumnsArray
        .map((col) => {
          let value = item[col.key];
          if (col.type === "currency") {
            value = typeof value === "number" ? value : parseFloat(value) || 0;
          }
          // Escape commas and quotes in CSV
          if (
            typeof value === "string" &&
            (value.includes(",") || value.includes('"'))
          ) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    );

    const csvContent = [headers, ...rows].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "table_data.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const visibleColumnsArray = columns.filter((col) => visibleColumns[col.key]);

  return (
    <div className="data-table-container">
      {/* Header Section */}
      <div className="table-header">
        <div className="search-container">
          <div className="search-input-wrapper">
            <span className="search-icon" style={{ padding: 0 }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                x="0px"
                y="0px"
                width="18"
                height="18"
                viewBox="0,0,256,256"
              >
                <g
                  fill="#646464"
                  fillRule="nonzero"
                  stroke="none"
                  strokeWidth="1"
                  strokeLinecap="butt"
                  strokeLinejoin="miter"
                  strokeMiterlimit="10"
                  strokeDasharray=""
                  strokeDashoffset="0"
                  fontFamily="none"
                  fontWeight="none"
                  fontSize="none"
                  textAnchor="none"
                  style={{ mixBlendMode: "normal" }}
                >
                  <g transform="scale(8.53333,8.53333)">
                    <path d="M13,3c-5.511,0 -10,4.489 -10,10c0,5.511 4.489,10 10,10c2.39651,0 4.59738,-0.85101 6.32227,-2.26367l5.9707,5.9707c0.25082,0.26124 0.62327,0.36648 0.97371,0.27512c0.35044,-0.09136 0.62411,-0.36503 0.71547,-0.71547c0.09136,-0.35044 -0.01388,-0.72289 -0.27512,-0.97371l-5.9707,-5.9707c1.41266,-1.72488 2.26367,-3.92576 2.26367,-6.32227c0,-5.511 -4.489,-10 -10,-10zM13,5c4.43012,0 8,3.56988 8,8c0,4.43012 -3.56988,8 -8,8c-4.43012,0 -8,-3.56988 -8,-8c0,-4.43012 3.56988,-8 8,-8z"></path>
                  </g>
                </g>
              </svg>
            </span>
            <input
              type="text"
              className="search-input"
              placeholder="Search"
              value={globalFilter}
              name="search"
              onChange={(e) => {
                setGlobalFilter(e.target.value);
                setCurrentPage(1);
              }}
            />
            {globalFilter && (
              <button className="clear-btn" onClick={clearGlobalFilter}>
                ×
              </button>
            )}
          </div>
        </div>

        <div className="header-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.xlsx,.xls"
            style={{ display: "none" }}
          />
          <button
            className="btn btn-outline"
            onClick={() => fileInputRef.current?.click()}
            title={"Upload file"}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 17 17"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 2L8 12M8 2L5 5M8 2L11 5M3 16L13 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="btn-text">Upload</span>
          </button>
          <button
            className="btn btn-outline"
            onClick={downloadAsExcel}
            disabled={data.length === 0}
            title={"download file"}
          >
            <span className="btn-text">Download</span>

            <svg
              width="16"
              height="16"
              viewBox="0 0 17 17"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 14L8 2M8 14L11 11M8 14L5 11M13 2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setShowColumnControls(!showColumnControls)}
          >
            ⚙️
            <span className="btn-text">Manage Columns</span>
          </button>
        </div>
      </div>

      {/* Column Controls */}
      {showColumnControls && (
        <div className="column-panel">
          <div className="panel-header">
            <h4>Column Visibility</h4>
            <button
              className="close-btn"
              onClick={() => setShowColumnControls(false)}
            >
              ×
            </button>
          </div>
          <div className="column-list">
            {columns.map((column) => (
              <label key={column.key} className="column-item">
                <input
                  type="checkbox"
                  checked={visibleColumns[column.key]}
                  onChange={() => toggleColumnVisibility(column.key)}
                />
                <span>{column.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {/* Table */}
      <div className="table-section">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {visibleColumnsArray.map((column) => (
                  <th
                    key={column.key}
                    className={`table-header-cell ${
                      column.sortable ? "sortable" : ""
                    } ${sortConfig.key === column.key ? "sorted" : ""}`}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="header-content">
                      <span className="header-text">{column.label}</span>
                      {column.sortable && (
                        <span className="sort-icon">
                          {getSortIcon(column.key)}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item, index) => (
                  <tr
                    key={item.id || index}
                    className={`table-row ${index % 2 === 0 ? "even" : "odd"}`}
                  >
                    {visibleColumnsArray.map((column) => (
                      <td key={column.key} className="table-cell">
                        <div className="cell-content">
                          {formatCellValue(item[column.key], column.type)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleColumnsArray.length} className="no-data">
                    <div className="no-data-content">
                      <span className="no-data-icon">🔍</span>
                      <h3>No data found</h3>
                      <p>
                        {data.length === 0
                          ? "Upload a CSV or Excel file to get started"
                          : "Try adjusting your search criteria"}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="pagination-wrapper">
        <div className="pagination-info">
          <span>Showing </span>
          <span className="range-highlight">
            {Math.min((currentPage - 1) * itemsPerPage + 1, sortedData.length)}{" "}
            - {Math.min(currentPage * itemsPerPage, sortedData.length)}
          </span>
          <span> of </span>
          <span className="total-highlight">{sortedData.length}</span>
          <span> entries</span>
        </div>

        <div className="pagination-controls">
          <button
            className="pagination-nav-btn"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            title="First page"
          >
            ⏮
          </button>
          <button
            className="pagination-nav-btn"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            title="Previous page"
          >
            ◀
          </button>

          <div className="page-numbers">
            <button className="page-number" aria-current="page">
              Page {currentPage} of {totalPages}
            </button>
          </div>

          <button
            className="pagination-nav-btn"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            title="Next page"
          >
            ▶
          </button>
          <button
            className="pagination-nav-btn"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            title="Last page"
          >
            ⏭
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
