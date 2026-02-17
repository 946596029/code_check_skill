import { useState, useEffect } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Space,
  Tag,
  Popconfirm,
  message,
  Typography,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  fetchRules,
  createRule,
  updateRule,
  deleteRule,
} from "../services/api";
import type { RuleRecord, RuleFormData } from "../types";

const { TextArea } = Input;
const { Text } = Typography;

export default function RuleManagementPage() {
  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRecord | null>(null);
  const [form] = Form.useForm<RuleFormData>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    setLoading(true);
    try {
      const data = await fetchRules();
      setRules(data);
    } catch {
      message.error("Failed to load rules");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      type: "prompt",
      enabled: true,
    });
    setModalOpen(true);
  }

  function openEdit(rule: RuleRecord) {
    setEditingRule(rule);
    form.setFieldsValue({
      name: rule.name,
      description: rule.description,
      type: rule.type,
      prompt_template: rule.prompt_template,
      enabled: rule.enabled,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (editingRule) {
        await updateRule(editingRule.id, values);
        message.success("Rule updated");
      } else {
        await createRule(values);
        message.success("Rule created");
      }

      setModalOpen(false);
      loadRules();
    } catch {
      // validation errors shown by form
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRule(id);
      message.success("Rule deleted");
      loadRules();
    } catch {
      message.error("Failed to delete rule");
    }
  }

  async function handleToggle(rule: RuleRecord) {
    try {
      await updateRule(rule.id, { enabled: !rule.enabled });
      loadRules();
    } catch {
      message.error("Failed to update rule");
    }
  }

  const columns: ColumnsType<RuleRecord> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (type: string) => (
        <Tag color={type === "prompt" ? "blue" : "green"}>{type}</Tag>
      ),
    },
    {
      title: "Enabled",
      dataIndex: "enabled",
      key: "enabled",
      width: 80,
      render: (_: boolean, record: RuleRecord) => (
        <Switch
          size="small"
          checked={record.enabled}
          onChange={() => handleToggle(record)}
        />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, record: RuleRecord) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          />
          <Popconfirm
            title="Delete this rule?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            cancelText="Cancel"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 14, color: "#666" }}>
          {rules.length} rule{rules.length !== 1 ? "s" : ""} configured
        </Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          New Rule
        </Button>
      </div>

      <Table
        dataSource={rules}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="middle"
      />

      <Modal
        title={editingRule ? "Edit Rule" : "Create Rule"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        width={640}
        okText="Save"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Please enter a rule name" }]}
          >
            <Input placeholder="e.g. No console.log" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input placeholder="Brief description of what this rule checks" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "prompt", label: "Prompt (LLM-based)" },
                { value: "code", label: "Code (pattern-based)" },
              ]}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.type !== cur.type}
          >
            {({ getFieldValue }) =>
              getFieldValue("type") === "prompt" ? (
                <Form.Item
                  name="prompt_template"
                  label="Prompt Template"
                  rules={[
                    {
                      required: true,
                      message: "Prompt template is required for prompt rules",
                    },
                  ]}
                >
                  <TextArea
                    rows={6}
                    placeholder={
                      "Describe the rule for the LLM reviewer.\n" +
                      "e.g.: Check that all functions have JSDoc comments."
                    }
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item
            name="enabled"
            label="Enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
