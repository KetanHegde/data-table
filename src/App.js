import DataTable from "./components/DataTable";
import { sampleData, columnConfig } from "./data/sampleData";
import "./App.css";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <div className="App">
      <header className="app-header">
        <h1>Data Table</h1>
      </header>
      <main>
        <DataTable data={sampleData} columns={columnConfig} itemsPerPage={10} />
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
