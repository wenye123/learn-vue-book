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
  function isAlpha(char) {
    // return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
    return ["<", ">", "/"].includes(char) === false;
  }

  // 标记化
  function tokenize(str) {
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
          } else if (isAlpha(char)) {
            currState = State.text;
            chars.push(char); // 收集字符
          }
          str = str.slice(1);
          break;
        case State.tagOpen:
          if (isAlpha(char)) {
            currState = State.tagName;
            chars.push(char); // 收集字符
          } else if (char === "/") {
            currState = State.tagEnd;
          }
          str = str.slice(1);
          break;
        case State.tagName:
          if (isAlpha(char)) {
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
          if (isAlpha(char)) {
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
          if (isAlpha(char)) {
            currState = State.tagEndName;
            chars.push(char);
          }
          str = str.slice(1);
          break;
        case State.tagEndName:
          if (isAlpha(char)) {
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
    const tokens = tokenize(str);
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
            content: token.content
          }
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

  let str = `<div><p>Vue</p><p>Template</p></div>`;
  console.log(parser(str));
})();
