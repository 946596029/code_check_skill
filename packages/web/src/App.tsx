import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider, theme } from "antd";
import AppLayout from "./components/AppLayout";
import CodeCheckPage from "./pages/CodeCheck";
import RuleManagementPage from "./pages/RuleManagement";

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 6,
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/check" element={<CodeCheckPage />} />
            <Route path="/rules" element={<RuleManagementPage />} />
            <Route path="*" element={<Navigate to="/check" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
