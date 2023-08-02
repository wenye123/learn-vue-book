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

  let str = "<p>hello</p>";
  console.log(tokenize(str));

})();
