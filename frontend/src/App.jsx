
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, Legend,
  ReferenceLine
} from "recharts";
import "./App.css";

const API = "http://127.0.0.1:5000";

const NAV = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "upload", label: "Dataset", icon: "⇧" },
  { id: "quality", label: "Data quality", icon: "◈" },
  { id: "training", label: "Model training", icon: "⚙" },
  { id: "performance", label: "Performance", icon: "▥" },
  { id: "fairness", label: "Fairness", icon: "⚖" },
  { id: "explainability", label: "Explainability", icon: "✳" },
  { id: "robustness", label: "Robustness", icon: "⌁" },
  { id: "reports", label: "Reports", icon: "▤" },
];

const COLORS = {
  blue: "#4978f5",
  green: "#18a77d",
  purple: "#8a6bed",
  orange: "#e99a40",
  red: "#e16d78",
};

function number(value, digits = 1) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function percent(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${number(n <= 1 ? n * 100 : n)}%`;
}

function MetricCard({ label, value, explanation, color }) {
  return (
    <article className="metric-card">
      <div className="metric-heading">
        <span>{label}</span>
        <span className={`metric-icon ${color}`}>✦</span>
      </div>
      <strong className="metric-value">{value ?? "—"}</strong>
      <p>{explanation}</p>
    </article>
  );
}

function Panel({ title, subtitle, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-heading">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <span className="panel-dots">•••</span>
      </header>
      {children}
    </section>
  );
}

function EmptyChart({ message = "Run a model evaluation to generate this chart." }) {
  return (
    <div className="empty-chart">
      <div className="empty-chart-icon">▤</div>
      <strong>Waiting for evaluation results</strong>
      <p>{message}</p>
    </div>
  );
}

function Insight({ title, children, tone = "blue" }) {
  return (
    <div className={`insight ${tone}`}>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

function Explanation({ title, children }) {
  return (
    <div className="explanation">
      <span className="explanation-mark">i</span>
      <div><strong>{title}</strong><p>{children}</p></div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState("overview");
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [target, setTarget] = useState("");
  const [sensitive, setSensitive] = useState("");
  const [model, setModel] = useState("Random Forest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState(null);
  const [quality, setQuality] = useState(null);
  const [progress, setProgress] = useState("");

  const performance = results?.performance ?? {};
  const fairness = results?.fairness ?? null;
  const explainability = results?.explainability ?? null;
  const robustness = results?.robustness ?? null;
  const confusion = results?.confusion_matrix ?? null;

  const performanceData = useMemo(() => {
    return [
      { metric: "Accuracy", value: performance.accuracy },
      { metric: "Precision", value: performance.precision },
      { metric: "Recall", value: performance.recall },
      { metric: "F1-score", value: performance.f1 },
    ].filter((item) => item.value !== null && item.value !== undefined)
      .map((item) => ({
        ...item,
        value: Number(item.value) <= 1 ? Number(item.value) * 100 : Number(item.value),
      }));
  }, [performance]);

  const featureData = useMemo(() => {
    const raw = explainability?.features ?? explainability?.feature_importance ?? [];
    return raw.map((item) => ({
      feature: item.feature ?? item.name ?? item[0] ?? "Feature",
      importance: Number(item.importance ?? item.value ?? item[1] ?? 0),
    })).sort((a, b) => b.importance - a.importance).slice(0, 10);
  }, [explainability]);

  const fairnessData = useMemo(() => {
    const groups = fairness?.groups ?? [];
    return groups.map((g) => ({
      group: String(g.group ?? g.name ?? "Group"),
      accuracy: g.accuracy == null ? null : Number(g.accuracy) * (Number(g.accuracy) <= 1 ? 100 : 1),
      tpr: (g.tpr ?? g.true_positive_rate) == null
        ? null
        : Number(g.tpr ?? g.true_positive_rate) * (Number(g.tpr ?? g.true_positive_rate) <= 1 ? 100 : 1),
      selection_rate: g.selection_rate == null
        ? null
        : Number(g.selection_rate) * (Number(g.selection_rate) <= 1 ? 100 : 1),
    }));
  }, [fairness]);

  const robustnessData = useMemo(() => {
    return (robustness?.tests ?? []).map((item) => ({
      perturbation: item.level ?? item.perturbation ?? item.name ?? "",
      stability: Number(item.stability ?? item.stability_rate ?? 0) *
        (Number(item.stability ?? item.stability_rate ?? 0) <= 1 ? 100 : 1),
    }));
  }, [robustness]);

  async function handleFile(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setError("");
    setNotice("");
    setResults(null);
    setQuality(null);
    setHeaders([]);
    setTarget("");
    setSensitive("");

    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }

    try {
      const firstLine = (await selected.slice(0, 50000).text()).split(/\r?\n/)[0];
      const parsedHeaders = firstLine.split(",").map((h) =>
        h.trim().replace(/^"|"$/g, "")
      );

      if (parsedHeaders.length < 2 || !parsedHeaders[0]) {
        throw new Error("The CSV needs a header row and at least two columns.");
      }

      setFile(selected);
      setHeaders(parsedHeaders);
      setTarget(parsedHeaders[parsedHeaders.length - 1]);
      setPage("upload");
      setNotice(`Loaded ${selected.name}. Choose the correct target column before training.`);
    } catch (e) {
      setError(e.message || "Could not read this CSV file.");
    }
  }

  async function analyzeQuality() {
    if (!file) {
      setError("Upload a CSV dataset first.");
      setPage("upload");
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);
    setProgress("Analyzing dataset quality…");

    try {
      const form = new FormData();
      form.append("file", file);

      const response = await fetch(`${API}/api/analyze-dataset`, {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Data quality analysis failed.");

      setQuality(data.data_quality ?? data);
      setNotice("Dataset quality analysis completed.");
      setPage("quality");
    } catch (e) {
      setError(
        `Data-quality API is not connected yet: ${e.message}. The frontend expects POST /api/analyze-dataset.`
      );
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  async function trainModel() {
    if (!file) {
      setError("Upload a CSV dataset first.");
      setPage("upload");
      return;
    }
    if (!target) {
      setError("Select the target column the model should predict.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    setProgress("Preparing data and training the model…");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("target", target);
      form.append("model", model);
      if (sensitive) form.append("sensitive", sensitive);

      const response = await fetch(`${API}/api/train`, {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Training failed.");

      if (!data.performance) {
        throw new Error("The API response is missing the performance object.");
      }

      setResults(data);
      setNotice("Model training and evaluation completed. Displayed metrics came from the backend response.");
      setPage("performance");
    } catch (e) {
      setError(
        `Training could not complete: ${e.message}. The frontend expects POST /api/train; we need to implement this endpoint in Flask.`
      );
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  const trained = Boolean(results?.performance);

  function renderPerformance() {
    return (
      <>
        <div className="metric-grid">
          <MetricCard label="Accuracy" value={percent(performance.accuracy)}
            explanation="Share of test predictions that were correct." color="blue" />
          <MetricCard label="Precision" value={percent(performance.precision)}
            explanation="Of predicted positives, the share that were correct." color="purple" />
          <MetricCard label="Recall" value={percent(performance.recall)}
            explanation="Of actual positives, the share the model found." color="green" />
          <MetricCard label="F1-score" value={percent(performance.f1)}
            explanation="Harmonic mean of precision and recall." color="orange" />
        </div>

        <div className="chart-grid">
          <Panel title="Performance metrics" subtitle="Measured on the held-out test set">
            {performanceData.length ? (
              <ResponsiveContainer width="100%" height={285}>
                <BarChart data={performanceData} margin={{ top: 15, right: 10, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9edf4" />
                  <XAxis dataKey="metric" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`${number(v)}%`, "Score"]} />
                  <Bar dataKey="value" name="Score" fill={COLORS.blue} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
            <Explanation title="How to interpret this chart">
              Higher values are generally better, but the most important metric depends on the task.
              For example, recall can be especially important when missing a positive case is costly.
            </Explanation>
          </Panel>

          <Panel title="Confusion matrix" subtitle="Correct and incorrect test predictions">
            {confusion?.matrix ? (
              <div className="matrix-wrap">
                <p className="matrix-label">Predicted class</p>
                <div className="matrix">
                  {confusion.matrix.flat().map((value, i) => (
                    <div className={`matrix-cell ${i === 0 || i === 3 ? "correct" : "incorrect"}`} key={i}>
                      <strong>{value}</strong>
                      <small>{i === 0 || i === 3 ? "Correct" : "Incorrect"}</small>
                    </div>
                  ))}
                </div>
                <p className="matrix-foot">Actual class → rows · Predicted class → columns</p>
              </div>
            ) : <EmptyChart message="The backend should return confusion_matrix.matrix and the class labels." />}
            <Explanation title="What the matrix tells us">
              Diagonal cells represent correct predictions. Off-diagonal cells represent mistakes.
              Their meaning depends on the class labels and the order returned by the backend.
            </Explanation>
          </Panel>
        </div>
      </>
    );
  }

  function renderFairness() {
    return (
      <>
        <Panel title="Group comparison" subtitle={`Sensitive attribute: ${sensitive || "not selected"}`}>
          {fairnessData.length ? (
            <ResponsiveContainer width="100%" height={330}>
              <BarChart data={fairnessData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9edf4" />
                <XAxis dataKey="group" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`${number(v)}%`]} />
                <Legend />
                <Bar dataKey="accuracy" name="Accuracy" fill={COLORS.blue} radius={[5, 5, 0, 0]} />
                <Bar dataKey="tpr" name="True positive rate" fill={COLORS.green} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart message="Select a sensitive attribute and implement group-wise metrics in the backend." />}
          <Explanation title="How to interpret group differences">
            Compare the same metric across groups. A difference signals a disparity to investigate;
            it does not, by itself, prove unfairness. The context, data, sample sizes and chosen fairness
            criterion matter.
          </Explanation>
        </Panel>
        {fairness?.summary && <Insight title="Backend interpretation" tone="purple">{fairness.summary}</Insight>}
      </>
    );
  }

  function renderExplainability() {
    return (
      <Panel title="Feature importance" subtitle="Features associated with model predictions">
        {featureData.length ? (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={featureData} layout="vertical" margin={{ top: 10, right: 25, left: 25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e9edf4" />
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="feature" type="category" width={130} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="importance" name="Importance" fill={COLORS.purple} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart message="The backend should return explainability.features or explainability.feature_importance." />}
        <Explanation title="What feature importance means">
          Higher importance indicates a feature contributes more under the method used. It does not
          establish causation, prove a prediction is correct, or automatically indicate fairness.
          The backend should state whether these are model-native importances or SHAP values.
        </Explanation>
        {explainability?.summary && <Insight title="Explanation summary" tone="purple">{explainability.summary}</Insight>}
      </Panel>
    );
  }

  function renderRobustness() {
    return (
      <Panel title="Perturbation stability" subtitle="Prediction consistency under controlled input changes">
        {robustnessData.length ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={robustnessData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9edf4" />
              <XAxis dataKey="perturbation" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${number(v)}%`, "Stability"]} />
              <ReferenceLine y={90} stroke="#d99a3f" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="stability" name="Prediction stability" stroke={COLORS.green} strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyChart message="The backend must run perturbation tests and return the measured stability at each level." />}
        <Explanation title="How to interpret stability">
          Stability is the share of tested perturbed inputs whose predictions remained unchanged.
          Higher stability means more consistent predictions under those specific tests, not resistance
          to every possible attack or change.
        </Explanation>
        {robustness?.summary && <Insight title="Robustness summary" tone="green">{robustness.summary}</Insight>}
      </Panel>
    );
  }

  function renderQuality() {
    const missing = quality?.missing_values;
    const duplicates = quality?.duplicate_rows;
    const outliers = quality?.outliers;
    return (
      <Panel title="Dataset quality report" subtitle={file?.name || "Upload a CSV to begin"}>
        {quality ? (
          <>
            <div className="quality-grid">
              <MetricCard label="Missing values" value={missing ?? "—"} explanation="Null or empty cells detected." color="blue" />
              <MetricCard label="Duplicate rows" value={duplicates ?? "—"} explanation="Rows matching earlier rows." color="purple" />
              <MetricCard label="Outliers" value={outliers ?? "—"} explanation="Count using the backend's stated rule." color="orange" />
              <MetricCard label="Records" value={quality.rows ?? "—"} explanation="Rows examined in the dataset." color="green" />
            </div>
            <Explanation title="Before training">
              Missing values, duplicates and outliers need context-specific handling. Outliers are not
              necessarily errors; inspect them before removing or changing data.
            </Explanation>
          </>
        ) : (
          <>
            <EmptyChart message="Dataset quality results will appear after the backend analyzes your uploaded CSV." />
            <button className="btn-primary" onClick={analyzeQuality} disabled={!file || loading}>
              {loading ? "Analyzing…" : "Analyze dataset quality"}
            </button>
          </>
        )}
      </Panel>
    );
  }

  function renderReports() {
    const report = {
      project: "TrustLens",
      dataset: file?.name ?? null,
      model,
      target,
      sensitive_attribute: sensitive || null,
      performance: results?.performance ?? null,
      confusion_matrix: results?.confusion_matrix ?? null,
      fairness: results?.fairness ?? null,
      explainability: results?.explainability ?? null,
      robustness: results?.robustness ?? null,
      data_quality: quality,
      generated_at: new Date().toISOString(),
    };

    return (
      <Panel title="Evaluation report" subtitle="Export the results returned by your backend">
        <p className="report-description">
          The report includes measured outputs only. Sections that have not been evaluated remain empty.
        </p>
        <button className="btn-primary" disabled={!trained && !quality} onClick={() => {
          const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "trustlens-evaluation-report.json";
          link.click();
          URL.revokeObjectURL(url);
        }}>Download evaluation report (JSON)</button>
      </Panel>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">T</div>
          <div><h2>TrustLens</h2><p>TRUSTWORTHY AI ANALYTICS</p></div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="nav-list">
          {NAV.map((item) => (
            <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => { setPage(item.id); setError(""); }}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {page === item.id && <span className="nav-current" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="online-dot" /> Local workspace
          <small>Flask · React · Scikit-learn</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><span className="breadcrumb">TrustLens / Workspace</span><h1>{NAV.find((item) => item.id === page)?.label}</h1></div>
          <div className="profile"><span className="profile-avatar">A</span><div><strong>Administrator</strong><small>ML evaluation workspace</small></div></div>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <span className="hero-kicker"><i /> MULTI-DIMENSIONAL MODEL EVALUATION</span>
            <h2>Look beyond accuracy.</h2>
            <p>Explore how a model predicts, which features influence it, how outcomes differ across groups, and how stable its predictions remain under tested changes.</p>
            <div className="hero-actions">
              <button className="btn-light" onClick={() => setPage("upload")}>＋ Upload dataset</button>
              <button className="btn-outline" onClick={() => setPage("training")}>Configure model ↗</button>
            </div>
          </div>
          <div className="hero-graphic" aria-hidden="true"><div className="hero-ring ring-a" /><div className="hero-ring ring-b" /><div className="hero-orb">T</div><i className="orb-dot dot-a" /><i className="orb-dot dot-b" /><i className="orb-dot dot-c" /></div>
        </section>

        {error && <div className="alert alert-error"><strong>Action required</strong><p>{error}</p></div>}
        {notice && <div className="alert alert-success"><strong>Workspace update</strong><p>{notice}</p></div>}
        {progress && <div className="alert alert-info"><span className="spinner" />{progress}</div>}

        <div className="section-heading">
          <div><h2>{page === "overview" ? "Evaluation overview" : NAV.find((item) => item.id === page)?.label}</h2><p>Results are displayed only when returned by the backend.</p></div>
          <span className={`state-pill ${trained ? "state-ready" : "state-pending"}`}><i />{trained ? "Evaluation available" : "Awaiting evaluation"}</span>
        </div>

        {page === "overview" && (
          <>
            <div className="metric-grid">
              <MetricCard label="Accuracy" value={percent(performance.accuracy)} explanation="Overall test-set correctness." color="blue" />
              <MetricCard label="Precision" value={percent(performance.precision)} explanation="Reliability of positive predictions." color="purple" />
              <MetricCard label="Recall" value={percent(performance.recall)} explanation="Actual positive cases detected." color="green" />
              <MetricCard label="F1-score" value={percent(performance.f1)} explanation="Balance between precision and recall." color="orange" />
            </div>
            <div className="chart-grid">
              <Panel title="Performance profile" subtitle="Measured test-set classification metrics">
                {performanceData.length ? (
                  <ResponsiveContainer width="100%" height={270}>
                    <BarChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9edf4" />
                      <XAxis dataKey="metric" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [`${number(v)}%`, "Score"]} />
                      <Bar dataKey="value" fill={COLORS.blue} radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </Panel>
              <Panel title="Trust dimensions" subtitle="Evaluation status by module">
                <div className="dimension-list">
                  {[
                    ["Performance", trained, "Test-set metrics"],
                    ["Fairness", Boolean(fairness), "Group-wise analysis"],
                    ["Explainability", Boolean(featureData.length), "Feature contribution"],
                    ["Robustness", Boolean(robustnessData.length), "Perturbation stability"],
                    ["Data quality", Boolean(quality), "Dataset inspection"],
                  ].map(([name, ready, desc]) => (
                    <div className="dimension-row" key={name}>
                      <span className={`dimension-icon ${ready ? "ready" : ""}`}>{ready ? "✓" : "·"}</span>
                      <div><strong>{name}</strong><small>{desc}</small></div>
                      <span className={`mini-status ${ready ? "ready-text" : ""}`}>{ready ? "Ready" : "Pending"}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
            <Panel title="How TrustLens evaluates a model" subtitle="The five dimensions work together; none alone proves a model is trustworthy.">
              <div className="dimension-cards">
                <button onClick={() => setPage("performance")}><b className="d-blue">01</b><strong>Performance</strong><span>How accurately does it predict?</span></button>
                <button onClick={() => setPage("fairness")}><b className="d-green">02</b><strong>Fairness</strong><span>Do outcomes differ across groups?</span></button>
                <button onClick={() => setPage("explainability")}><b className="d-purple">03</b><strong>Explainability</strong><span>Which features influence predictions?</span></button>
                <button onClick={() => setPage("robustness")}><b className="d-orange">04</b><strong>Robustness</strong><span>Are predictions stable under tested changes?</span></button>
              </div>
            </Panel>
          </>
        )}

        {page === "upload" && (
          <Panel title="Upload a dataset" subtitle="CSV input for data quality analysis and model training">
            <label className="upload-zone">
              <span className="upload-symbol">↑</span>
              <strong>{file ? file.name : "Choose a CSV file"}</strong>
              <small>{file ? `${(file.size / 1024).toFixed(1)} KB · ${headers.length} columns detected` : "Select a dataset from your computer"}</small>
              <input type="file" accept=".csv,text/csv" onChange={handleFile} />
            </label>
            {headers.length > 0 && <div className="field"><label>Target column (what the model should predict)</label><select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose target column</option>{headers.map((h) => <option key={h}>{h}</option>)}</select></div>}
            {headers.length > 0 && <div className="field"><label>Sensitive/group attribute (optional)</label><select value={sensitive} onChange={(e) => setSensitive(e.target.value)}><option value="">None selected</option>{headers.filter((h) => h !== target).map((h) => <option key={h}>{h}</option>)}</select><small>Choose a relevant group column only if it is appropriate for your dataset.</small></div>}
            <div className="button-row"><button className="btn-primary" disabled={!file} onClick={analyzeQuality}>Analyze data quality</button><button className="btn-secondary" disabled={!file} onClick={() => setPage("training")}>Continue to training →</button></div>
          </Panel>
        )}

        {page === "quality" && renderQuality()}

        {page === "training" && (
          <Panel title="Model training configuration" subtitle="Train on a training split and evaluate on held-out test data">
            <div className="field"><label>Selected dataset</label><div className="readout">{file?.name || "No dataset selected"}</div><button className="btn-secondary" onClick={() => setPage("upload")}>Choose dataset</button></div>
            <div className="field"><label>Algorithm</label><select value={model} onChange={(e) => setModel(e.target.value)}><option>Random Forest</option><option>Decision Tree</option><option>Logistic Regression</option></select></div>
            <div className="field"><label>Target column</label><select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose target column</option>{headers.map((h) => <option key={h}>{h}</option>)}</select></div>
            <div className="field"><label>Group attribute for fairness (optional)</label><select value={sensitive} onChange={(e) => setSensitive(e.target.value)}><option value="">None selected</option>{headers.filter((h) => h !== target).map((h) => <option key={h}>{h}</option>)}</select></div>
            <div className="training-note"><strong>Evaluation protocol</strong><p>The backend should split the data before fitting preprocessing, train only on the training split, and calculate final metrics on held-out test data. Any tuning must avoid using test data.</p></div>
            <button className="btn-primary" disabled={loading || !file || !target} onClick={trainModel}>{loading ? "Training…" : "▶ Start training & evaluation"}</button>
          </Panel>
        )}

        {page === "performance" && renderPerformance()}
        {page === "fairness" && renderFairness()}
        {page === "explainability" && renderExplainability()}
        {page === "robustness" && renderRobustness()}
        {page === "reports" && renderReports()}

        <footer className="footer"><span>TrustLens · ML model evaluation</span><span>Performance · Fairness · Explainability · Robustness</span><span><i className="online-dot" /> Local development</span></footer>
      </main>
    </div>
  );
}

export default App;
