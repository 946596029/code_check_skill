import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Layout, Menu } from "antd";
import {
  CodeOutlined,
  OrderedListOutlined,
} from "@ant-design/icons";

const { Sider, Content, Header } = Layout;

const menuItems = [
  {
    key: "/check",
    icon: <CodeOutlined />,
    label: "Code Check",
  },
  {
    key: "/rules",
    icon: <OrderedListOutlined />,
    label: "Rules",
  },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={200}
      >
        <div
          style={{
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: collapsed ? 14 : 16,
            letterSpacing: 1,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {collapsed ? "CC" : "Code Check"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {location.pathname === "/check"
            ? "Code Check"
            : location.pathname === "/rules"
              ? "Rule Management"
              : "Code Check"}
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 20,
            background: "#fff",
            borderRadius: 8,
            overflow: "auto",
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
