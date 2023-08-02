(() => {
  const State = {
    initial: 1, // 初始状态
    tagOpen: 2, // 标签开始状态
    tagName: 3, // 标签开始名称状态
    text: 4, // 文本状态
    tagEnd: 5, // 标签结束状态
    tagEndName: 6, // 标签结束名称状态
  };
  // 是否字母
  function _isAlpha(char) {
    // return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
    return ["<", ">", "/"].includes(char) === false;
  }

  // 标记化
  function _tokenize(str) {
    // 当前状态 默认为初始状态
    let currState = State.initial;
    // 缓存字符
    const chars = [];
    // 生成的token数组
    const tokens = [];

    // 只有要字符就一直进行
    while (str) {
      // 第一个字符
      const char = str[0];
      switch (currState) {
        case State.initial:
          if (char === "<") {
            currState = State.tagOpen;
          } else if (_isAlpha(char)) {
            currState = State.text;
            chars.push(char); // 收集字符
          }
          str = str.slice(1);
          break;
        case State.tagOpen:
          if (_isAlpha(char)) {
            currState = State.tagName;
            chars.push(char); // 收集字符
          } else if (char === "/") {
            currState = State.tagEnd;
          }
          str = str.slice(1);
          break;
        case State.tagName:
          if (_isAlpha(char)) {
            chars.push(char); // 收集字符
          } else if (char === ">") {
            currState = State.initial;
            // 收集标签token
            tokens.push({
              type: "tag",
              name: chars.join("").trim(),
            });
            // 重置收集字符
            chars.length = 0;
          }
          str = str.slice(1);
          break;
        case State.text:
          if (_isAlpha(char)) {
            chars.push(char); // 收集字符
          } else if (char === "<") {
            currState = State.tagOpen;
            // 收集文本token
            tokens.push({
              type: "text",
              content: chars.join(""),
            });
            // 重置收集字符
            chars.length = 0;
          }
          str = str.slice(1);
          break;
        case State.tagEnd:
          if (_isAlpha(char)) {
            currState = State.tagEndName;
            chars.push(char);
          }
          str = str.slice(1);
          break;
        case State.tagEndName:
          if (_isAlpha(char)) {
            chars.push(char);
          } else if (char === ">") {
            currState = State.initial;
            // 收集结束标签token
            tokens.push({
              type: "tagEnd",
              name: chars.join("").trim(),
            });
            // 重置收集字符
            chars.length = 0;
          }
          str = str.slice(1);
          break;
      }
    }

    return tokens;
  }

  // 生成ast语法数
  function parser(str) {
    const tokens = _tokenize(str);
    // 根节点
    const root = {
      type: "Root",
      children: [],
    };
    // 节点栈
    const elementStack = [root];

    // 循环tokens进行操作
    while (tokens.length) {
      // 当前token
      const token = tokens[0];
      // 栈顶
      const stackTop = elementStack[elementStack.length - 1];

      // 循环处理tokens
      switch (token.type) {
        case "tag":
          // 元素节点
          const elementNode = {
            type: "Element",
            tag: token.name,
            children: [],
          };
          // 将元素节点添加父节点children中
          stackTop.children.push(elementNode);
          // 添加到栈
          elementStack.push(elementNode);
          break;
        case "text":
          // 文本节点
          const textNode = {
            type: "Text",
            content: token.content,
          };
          // 将文本节点添加到父节点children中
          stackTop.children.push(textNode);
          break;
        case "tagEnd":
          // 弹出栈顶
          elementStack.pop();
          break;
      }
      tokens.shift();
    }

    return root;
  }

  // 打印ast节点信息
  function _dumpAST(ast, indent = 0) {
    const type = ast.type;
    const desc =
      type === "Root" ? "" : type === "Element" ? ast.tag : ast.content;
    console.log(`${"-".repeat(indent)}${type}: ${desc}`);
    if (ast.children) {
      ast.children.forEach((child) => {
        _dumpAST(child, indent + 2);
      });
    }
  }

  // 遍历处理ast
  function _traverseAST(ast, context) {
    // 设置context当前节点
    context.currNode = ast;

    // 执行转换器
    const exitFns = []; // 退出函数数组
    const nodeTransforms = context.nodeTransforms;
    for (let i = 0; i < nodeTransforms.length; i++) {
      // 如果转换器返回退出执行函数则添加
      const onExit = nodeTransforms[i](context.currNode, context);
      if (onExit && typeof onExit === "function") {
        exitFns.push(onExit);
      }
      // 转换器可能删除节点 如果节点被删除 则后面的转换器无须执行
      if (!context.currNode) return;
    }

    const children = context.currNode.children;
    if (children) {
      for (let i = 0; i < children.length; i++) {
        // 设置context的父节点和childIndex
        context.parent = context.currNode;
        context.childIndex = i;
        // 递归
        _traverseAST(children[i], context);
      }
    }

    // 执行完children后执行退出函数
    // 记得反向执行 这样才能确保当前执行器执行时 后面执行器的退出函数都执行完了
    let i = exitFns.length - 1;
    while (i >= 0) {
      exitFns[i]();
      i--;
    }
  }

  // 转换ast
  function transform(ast, nodeTransforms) {
    // 上下文
    const context = {
      currNode: null, // 当前节点
      childIndex: 0, // 当前节点在父节点children中的索引
      parent: null, // 父节点
      // 替换节点
      replaceNode(node) {
        context.parent.children[context.childIndex] = node;
        // 替换完将当前节点指向新节点
        context.currNode = node;
      },
      // 删除节点
      removeNode(node) {
        if (context.parent) {
          context.parent.children.splice(context.childIndex, 1);
          // 删除完将当前节点指向null
          context.currNode = null;
        }
      },
      nodeTransforms, // 节点转换器
    };

    // 处理ast
    _traverseAST(ast, context);

    return ast;
  }

  // 转换工具函数
  // 创建identifier工具函数
  function _createIdentifier(name) {
    return {
      type: "Identifier",
      name,
    };
  }
  // 创建StringLiteral节点
  function _createStringLiteral(value) {
    return {
      type: "StringLiteral",
      value: value,
    };
  }
  // 创建ArrayExpression节点
  function _createArrayExpression(elements) {
    return {
      type: "ArrayExpression",
      elements,
    };
  }
  // 创建CallExpression节点
  function _createCallExpression(callee, arguments) {
    return {
      type: "CallExpression",
      // 调用函数名称
      callee: _createIdentifier(callee),
      // 名称参数
      arguments,
    };
  }

  // 转换文本节点
  function _transformText(node) {
    if (node.type !== "Text") return;
    node.jsNode = _createStringLiteral(node.content);
  }
  // 转换标签节点
  function _transformElement(node) {
    // 写在退出函数中 确保子节点都处理完毕
    return () => {
      if (node.type !== "Element") return;
      // 创建h函数 第一个参数就是标签名
      const callExp = _createCallExpression("h", [
        _createStringLiteral(node.tag),
      ]);
      // 子节点只有一个值就直接push 否则push一个数组
      node.children.length === 1
        ? callExp.arguments.push(node.children[0].jsNode)
        : callExp.arguments.push(
            _createArrayExpression(node.children.map((child) => child.jsNode))
          );
      // 将当前jsAST赋值到当前节点
      node.jsNode = callExp;
    };
  }
  // 转换根节点
  function _transformRoot(node) {
    // 写在退出函数中 确保子节点都处理完毕
    return () => {
      if (node.type !== "Root") return;
      // 这里只考虑只有一个根节点情况
      const chidJsNode = node.children[0].jsNode;
      // 赋值
      node.jsNode = {
        type: "FunctionDecl",
        // 函数名称
        id: {
          type: "Identifier",
          name: "render",
        },
        // 函数参数
        params: [],
        // 函数体
        body: [
          {
            type: "ReturnStatement", // return 语句
            return: chidJsNode,
          },
        ],
      };
    };
  }

  /***********************例子***************************/

  let str = `<div><p>Vue</p><p>Template</p></div>`;
  const ast = parser(str);
  transform(ast, [_transformRoot, _transformText, _transformElement]);
  console.log("jsNode", JSON.stringify(ast.jsNode));

  /*-----------------------------------实例-------------------------------------------*/
  {
    /* 函数声明 */
    // function render() { return null }
    const FunctionDeclNode = {
      type: "FunctionDecl",
      // 函数名称
      id: {
        type: "Identifier",
        name: "render",
      },
      // 函数参数
      params: [],
      // 函数体
      body: [
        {
          type: "ReturnStatement", // return 语句
          return: null,
        },
      ],
    };

    /* 调用函数表达式 */
    // h()
    const CallExp = {
      type: "CallExpression",
      // 调用函数名称
      callee: {
        type: "Identifier",
        name: "h",
      },
      // 名称参数
      arguments: [],
    };

    /* 字符串 */
    // "div"
    const Str = {
      type: "StringLiteral",
      value: "div",
    };

    /* 数组 */
    // []
    const Arr = {
      type: "ArrayExpression",
      elements: [],
    };
  }
  {
    /*
      function render () {
        return h("div", [
          h("p", "vue"),
          h("p", "template")
        ])
      }
    */
    const FunctionDeclNode = {
      type: "FunctionDecl",
      id: {
        type: "Identifier",
        name: "render",
      },
      params: [],
      // 函数体
      body: [
        // 只有一个return语句
        {
          type: "ReturnStatement",
          // 调用h函数
          return: {
            type: "CallExpression",
            callee: {
              type: "Identifier",
              name: "h",
            },
            arguments: [
              // 第一个参数是字符串div
              { type: "StringLiteral", value: "div" },
              // 第二个是数组
              {
                type: "ArrayExpression",
                elements: [
                  // 数组的第一个参数是调用h函数
                  {
                    type: "CallExpression",
                    callee: {
                      type: "Identifier",
                      name: "h",
                    },
                    // h函数的两个参数是字符串
                    arguments: [
                      { type: "StringLiteral", value: "p" },
                      { type: "StringLiteral", value: "vue" },
                    ],
                  },
                  // 数组的第二个参数是调用h函数
                  {
                    type: "CallExpression",
                    callee: {
                      type: "Identifier",
                      name: "h",
                    },
                    // h函数的两个参数是字符串
                    arguments: [
                      { type: "StringLiteral", value: "p" },
                      { type: "StringLiteral", value: "tempalte" },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    };
  }
})();
