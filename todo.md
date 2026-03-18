# TODO
## 当前最高优先级（P0）
- [x] 通过命令行完成 workflow 的资源检查。
    - 命令：`code-check <workflow_name> <file_path>`
- [x] 规范检查结果类型，明确各属性的必填与选填要求。
- [x] 调整各个规则的检查结果输出，确保符合统一结果标准。
    - [x] 通过的规则需要展示一下被匹配的代码位置
    - [x] 未通过的规则需要展示全部的 Result 信息
    - 到这里就具备能够人工介入的黑盒调试能力了
- [ ] 校验所有检查规则，补充测试样例并迭代到符合预期。

- [] 需要考虑一下链式接口的扩展问题，设计问题
- [] 怎样检查这种描述的问题呢？
    - 存在多种规范性的描述
    - 多种规范性描述还可以组合
    - 规范性描述中有一些可变项


## 使用问题
- [] workflow 需要实现的检查规则
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
                - 子对象参数属性有这个标识吗？
            - [] 对于子参数引用的描述怎样检查？
                - 对于应用处的检查
                    - The [${resource_name}](#ref_block_name) structure is documented below.
                - 对于引用实现的检查
                    - <a name="#ref_block_name" ></a>
                      The `${resource_name}` block supports:

            - [] Required 参数需要放在 Optional 参数前面
            - [] Region 参数一般都要使用 ForceNew 标签
            - [] 含有 ForceNew 标签的参数，需要有描述 Changing this will create a new resource
            - [] 关于参数可选值的描述，有以下这些例子
                - The valid values are **tcp** and **udp**. Defaults to **tcp**.
                - The valid values is range from `1` to `65,535`.
                - The valid values are as follows:
                  + **1**: Available
                  + xxxx
            - [] 表达仅有哪些内容被支持的描述，有以下这些例子
                - Only letters, digits and underscores (_) are allowed.
            - [] 表达长度限制
                - The valid length is limited from `3` to `64`.
                - The ${resource_name} contain a maximum of `255` characters.
            - [] 表达仅有某种情况被支持
                - Only supported when ${attribute name} is ${value}.
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
        - [] 每行不超过 120 字符的检查，超过需要软换行

    - [] 语义检查
        - [] 前置动作，需要支持解析 Go 语言文件，来获取 schema 信息

## 设计目标
- [x] 先打通一个 workflow, 针对 Markdown 文件走通一次检查流程  **重点**
- [x] 修改入口目标，使其能够进行测试
    - 1. 打开到 package 目录下
    - 2. pnpm cli -- <workflow_name> ${file_path}
- [x] 收集规则样例，实现 `意图文本规范化` 功能
- [] 重构 `意图文本规范化` 代码，这部分代码的结构不行
- [] 编写资源的解析逻辑
- [x] 添加一个 cli 接口, `code-check ${workflow_name} ${file_path}`

## 测试命令
- 查看支持的工作流
    - `code-check list workflow`
    - `pnpm cli -- list workflow`
- 使用某个工作流检查资源
    - `code-check ${workflow_name} ${file_path}`
    - `pnpm cli -- ${workflow_name} ${file_path}`
    - 示例 `code-check <workflow_name> ../../xxx.md`
- `workflow_name` 请使用 `code-check list workflow` 返回的 id
- 获取某个 markdown 文档的 ast 结构 `npx tsx .../scripts/parse-markdown.ts`

## 设计思考
1. 先进行核心功能的实现
2. 一个能不影响核心功能的实现就可以不做
3. 现在只实现 cmd 的交互，通过命令来执行一个具体的检查，解决问题才是关键
4. 实现和优化分开，在平常的时候先注重功能实现，后面有大段的时间可以进行优化

## 技术细节
1. ast pattern 负责结构匹配
2. line pattern 负责文本匹配
3. 实现 Rule 树形子规则控制
4. RuleContext 采用链式查找，解决合并查询问题
5. section check 负责工具的组合
