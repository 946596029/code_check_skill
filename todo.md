# TODO
- [] 需要考虑一下链式接口的扩展问题，设计问题

## 使用问题
- [] resource-doc workflow 需要实现的检查规则
    - [] 语法检查
        - [x] 元信息检查，并解析元信息
        - [x] 一级目录检查
            - [x] 一级目录标题与元信息`资源名称`一致
            - [x] 一级目录下描述与元信息`资源描述`一致
        - [] 二级目录 Example Usage 检查
            - [x] 检查结构
                - 单独默认样例
                - 多个样例，但每个样例需要伴随一个三级标题
            - [x] 二级目录跟随描述为固定语句
        - [] 二级目录 Argument Reference 检查
            - [x] 检查二级目录结构，是否为 (list paragraph?)+
            - [x] 二级目录跟随描述为固定语句
            - [x] 检查每个 list item 格式是否为 Argument 标准格式
                - "* `arg_name` - (Optional, Int) Specifies xxx"
        - [] 二级目录 Attributes Reference 检查
            - [x] 检查二级目录结构，是否为 (list paragraph?)+
            - [x] 二级目录跟随描述为固定语句
            - [x] 检查每个 list item 格式是否为 Attribute 标准格式
                - "* `attr_name` - xxx"
        - [] 二级目录 Import 检查
        - [] 二级目录 TimeOut 检查
        - [] 格式规则，明天将这部分修改正确
            - [] 对于所有的数字，除了被 ** 包围的，和时间戳，其他都要使用 `` 强调，并采取千分位标记法
            - [] 对于一些专有名词，需要大写, 比如 IP
            - [] 对于一些特殊表述，有固定的格式
        
    - [] 语义检查
        - [] 前置动作，需要支持解析 Go 语言文件，来获取 schema 信息
        

## 设计目标
- [x] 先打通一个 workflow, 针对 Markdown 文件走通一次检查流程  **重点**
- [x] 修改入口目标，使其能够进行测试
    - 1. 打开到 package 目录下
    - 2. pnpm cli -- resource-doc ${file_path}

## 测试命令
- 查看支持的工作流 `code-check list workflow`
- 使用某个工作流检查资源 `code-check ${workflow_name} ${resource_name}`
- 获取某个 markdown 文档的 ast 结构 `npx tsx .../scripts/parse-markdown.ts`

## 设计思考
1. 先进行核心功能的实现
2. 一个能不影响核心功能的实现就可以不做
3. 现在只实现 cmd 的交互，通过命令来执行一个具体的检查，解决问题才是关键

## 技术细节
1. ast pattern 负责结构匹配
2. line pattern 负责文本匹配
3. 实现 Rule 树形子规则控制
4. RuleContext 采用链式查找，解决合并查询问题
