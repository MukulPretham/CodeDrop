import { useEffect, useRef, useState } from 'react'
import './App.css'

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState("");
  const [id, setId] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);

  let deployHandler = async () => {
    if (!inputRef.current?.value) return;
    setDeploying(true);
    setResult(""); // Clear previous results
    let response = await fetch("http://localhost:3000/deploy", {
      method: "POST",
      headers:{
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: inputRef.current?.value
      })
    })
    const data = await response.json();
    if(data.error){
      setResult(data.error);
      setDeploying(false);
      return;
    }
    setId(data?.id);
  }

  useEffect(() => {
    if (!id) return;
    const interval = setInterval(async () => {
      const response = await fetch(`http://localhost:3000/status/${id}`);
      const data = await response.json();
      if (data.status === "completed") {
        setResult(`http://${id}.localhost:3001/index.html`);
        setDeploying(false);
        clearInterval(interval);
      }
      if (data.status === "error") {
        setResult(data.error || "An unknown error occurred.");
        setDeploying(false);
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [id]);


  // Determine if the result is a success URL or an error message
  const isSuccess = result.startsWith('http');

  return (
    <div className="container">
      <header className="header">
        <h2>🚀 Deploy Your Website</h2>
        <p>Enter your GitHub repository URL to deploy a static site instantly.</p>
      </header>

      <main className="main-content">
        <div className="input-group">
          <input
            ref={inputRef}
            type="text"
            placeholder="https://github.com/user/repo"
            disabled={deploying}
          />
          <button onClick={deployHandler} disabled={deploying}>
            {deploying ? 'Deploying...' : 'Deploy'}
          </button>
        </div>

        {deploying && (
          <div className="status-box deploying">
            <div className="spinner"></div>
            <p>Deployment in progress. Please wait...</p>
          </div>
        )}

        {result && !deploying && (
          <div className={`status-box ${isSuccess ? 'success' : 'error'}`}>
            {isSuccess ? (
              <>
                <p>✅ Success! Your site is live:</p>
                <a href={result} target="_blank" rel="noopener noreferrer">
                  {result}
                </a>
              </>
            ) : (
              <>
                <p>❌ Error:</p>
                <code>{result}</code>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App;