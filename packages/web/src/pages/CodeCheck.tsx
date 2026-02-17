import { useState, useEffect, useRef } from "react";
import {
  Row,
  Col,
  Button,
  Select,
  Checkbox,
  Card,
  Tag,
  Spin,
  Empty,
  Alert,
  Collapse,
  Typography,
  Space,
  Tooltip,
} from "antd";
import {
  PlayCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { fetchRules, runCheck } from "../services/api";
import type { RuleRecord, CheckResult } from "../types";

const { Text } = Typography;

const LANGUAGE_OPTIONS = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "markdown", label: "Markdown" },
  { value: "json", label: "JSON" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "plaintext", label: "Plain Text" },
];

export default function CodeCheckPage() {
  const [code, setCode] = useState<string>("// Paste your code here\n");
  const [language, setLanguage] = useState<string>("typescript");
  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalRules, setTotalRules] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    try {
      const data = await fetchRules();
      const enabledRules = data.filter((r) => r.enabled);
      setRules(enabledRules);
    } catch {
      setError("Failed to load rules. Make sure the backend is running.");
    }
  }

  function handleCheck() {
    if (!code.trim() || selectedRuleIds.length === 0) return;

    setRunning(true);
    setResults([]);
    setError(null);
    setTotalRules(selectedRuleIds.length);

    controllerRef.current = runCheck(code, selectedRuleIds, language, {
      onResult(result) {
        setResults((prev) => [...prev, result]);
      },
      onDone() {
        setRunning(false);
      },
      onError(msg) {
        setError(msg);
        setRunning(false);
      },
    });
  }

  function handleStop() {
    controllerRef.current?.abort();
    setRunning(false);
  }

  function toggleRule(id: string) {
    setSelectedRuleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  function selectAllRules() {
    setSelectedRuleIds(rules.map((r) => r.id));
  }

  function deselectAllRules() {
    setSelectedRuleIds([]);
  }

  const passedCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Top controls */}
      <Row gutter={12} align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Select
            value={language}
            onChange={setLanguage}
            options={LANGUAGE_OPTIONS}
            style={{ width: 160 }}
          />
        </Col>
        <Col flex="auto" />
        <Col>
          {running ? (
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleStop}
            >
              Stop
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleCheck}
              disabled={selectedRuleIds.length === 0 || !code.trim()}
            >
              Run Check
            </Button>
          )}
        </Col>
      </Row>

      {error && (
        <Alert
          type="error"
          message={error}
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* Main content: editor + rule selector / results */}
      <Row gutter={16} style={{ flex: 1, minHeight: 0 }}>
        {/* Code editor */}
        <Col span={16} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Card
            size="small"
            title="Source Code"
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
            styles={{ body: { flex: 1, padding: 0, overflow: "hidden" } }}
          >
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={(v) => setCode(v || "")}
              theme="vs"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
              }}
            />
          </Card>
        </Col>

        {/* Right panel: rule selector + summary */}
        <Col span={8} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Card
            size="small"
            title="Rules"
            extra={
              <Space size="small">
                <Button size="small" type="link" onClick={selectAllRules}>
                  All
                </Button>
                <Button size="small" type="link" onClick={deselectAllRules}>
                  None
                </Button>
              </Space>
            }
            style={{
              marginBottom: 12,
              maxHeight: "40%",
              overflow: "auto",
            }}
          >
            {rules.length === 0 ? (
              <Empty
                description="No rules configured"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    padding: "6px 0",
                    borderBottom: "1px solid #f5f5f5",
                  }}
                >
                  <Checkbox
                    checked={selectedRuleIds.includes(rule.id)}
                    onChange={() => toggleRule(rule.id)}
                  >
                    <Tooltip title={rule.description || rule.prompt_template}>
                      <Text strong style={{ fontSize: 13 }}>
                        {rule.name}
                      </Text>
                    </Tooltip>
                  </Checkbox>
                  <Tag
                    color={rule.type === "prompt" ? "blue" : "green"}
                    style={{ marginLeft: 4, fontSize: 11 }}
                  >
                    {rule.type}
                  </Tag>
                </div>
              ))
            )}
          </Card>

          {/* Results */}
          <Card
            size="small"
            title={
              <Space>
                <span>Results</span>
                {running && <Spin indicator={<LoadingOutlined spin />} size="small" />}
                {!running && results.length > 0 && (
                  <>
                    <Tag icon={<CheckCircleOutlined />} color="success">
                      {passedCount}
                    </Tag>
                    <Tag icon={<CloseCircleOutlined />} color="error">
                      {failedCount}
                    </Tag>
                  </>
                )}
              </Space>
            }
            style={{ flex: 1, overflow: "auto" }}
          >
            {running && results.length === 0 && (
              <div style={{ textAlign: "center", padding: 24 }}>
                <Spin tip="Checking..." />
              </div>
            )}

            {running && results.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">
                  {results.length} / {totalRules} rules checked
                </Text>
              </div>
            )}

            {!running && results.length === 0 && (
              <Empty
                description="Run a check to see results"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}

            <Collapse
              accordion
              size="small"
              items={results.map((r, i) => ({
                key: String(i),
                label: (
                  <Space>
                    {r.success ? (
                      <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                    )}
                    <Text strong>{r.rule_name}</Text>
                  </Space>
                ),
                children: <ResultDetail result={r} />,
              }))}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function ResultDetail({ result }: { result: CheckResult }) {
  const [showDiff, setShowDiff] = useState(false);
  const hasDiff =
    result.suggested &&
    result.original &&
    result.suggested !== result.original;

  return (
    <div>
      <Text style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
        {result.message}
      </Text>
      {hasDiff && (
        <div style={{ marginTop: 12 }}>
          <Button
            size="small"
            type="link"
            onClick={() => setShowDiff(!showDiff)}
          >
            {showDiff ? "Hide Diff" : "Show Diff"}
          </Button>
          {showDiff && (
            <div
              style={{
                marginTop: 8,
                border: "1px solid #d9d9d9",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <DiffEditor
                height={300}
                original={result.original}
                modified={result.suggested}
                language="typescript"
                theme="vs"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 12,
                  scrollBeyondLastLine: false,
                  renderSideBySide: true,
                  automaticLayout: true,
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
