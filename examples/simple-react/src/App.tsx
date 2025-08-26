import "./App.css";
import { DruidUI } from "../../../src/react";

function App() {
  return (
    <>
      <h1>Vite + React + Druid UI</h1>
      <div className="card">
        <DruidUI entrypoint="simple.lua" path="/" />
      </div>
    </>
  );
}

export default App;
