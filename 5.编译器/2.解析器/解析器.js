// 模式代码很多自己写的
// CDATA模式没有专门设置过也能正常运行
(() => {
  function logger(msg, ...args) {
    console.log(msg, ...args);
  }
  /**
    标签节点: <div>
    文本插值节点: {{ msg }}
    普通文本节点: text 
    注释节点: <!---->
    CDATA节点: <! [CDATA[]]>
   * */
  // 文本模式
  const TextMode = {
    DATA: "DATA",
    RCDATA: "RCDATA",
    RAWTEXT: "RAWTEXT",
    CDATA: "CDATA",
  };

  // 是否循环结束
  let count = 0;
  function __isEnd(context, parentStack) {
    if (count++ > 100) return true;
    // 模板解析完毕停止
    if (!context.template) return true;
    // 倒序父节点存在同步标签则停止
    // 注意: 原书匹配</${parent.tag} 后面没有>
    for (let i = parentStack.length - 1; i >= 0; i--) {
      const parent = parentStack[i];
      if (context.template.startsWith(`</${parent.tag}>`)) return true;
    }
    return false;
  }

  // 解析注释
  function __parseComment(context) {
    const { advanceByNum, advanceSpaces } = context;
    // 消费开始
    advanceByNum("<!--".length);
    // 获取结束索引
    const closeIndex = context.template.indexOf("-->");
    if (closeIndex === -1) throw new Error("注释缺少结束符号");
    // 获取content
    const content = context.template.slice(0, closeIndex);
    // 消费content和结束符号
    advanceByNum(content.length);
    advanceByNum("-->".length);
    // 返回插值类型
    return {
      type: "Comment",
      content,
    };
  }
  // 解析CDATA
  // 注意: 自己编写
  function __parseCDATA(context, parentStack) {
    const { advanceByNum, advanceSpaces } = context;
    // 消费开始
    advanceByNum("<! [CDATA[".length);
    // 获取结束索引
    const closeIndex = context.template.indexOf("]]>");
    if (closeIndex === -1) throw new Error("CDATA缺少结束符号");
    // 获取content
    const content = context.template.slice(0, closeIndex);
    // 消费content和结束符号
    advanceByNum(content.length);
    advanceByNum("]]>".length);
    // 返回插值类型
    return {
      type: "CDATA",
      content,
    };
  }

  // 解析元素属性
  function ____parseAttr(context) {
    const { advanceByNum, advanceSpaces } = context;
    const props = [];

    // 只要没碰到结尾元素就循环
    while (
      !context.template.startsWith(">") &&
      !context.template.startsWith("/>")
    ) {
      // 匹配名称
      const match = /^[^\t\r\n\f />][^\t\r\n\f/>=]*/.exec(context.template);
      // 属性名
      const name = match[0];

      // 消费属性名 空白 等号 空白
      advanceByNum(name.length);
      advanceSpaces();
      advanceByNum(1);
      advanceSpaces();

      // 属性值
      let value = "";
      // 第一个字符
      const quote = context.template[0];
      // 第一个字符是否引号
      const isQuote = quote === '"' || quote === "'";
      if (isQuote) {
        // 是引号
        // 消费第一个引号
        advanceByNum(1);
        // 结束引号的索引
        const endQuoteIndex = context.template.indexOf(quote);
        if (endQuoteIndex > -1) {
          value = context.template.slice(0, endQuoteIndex);
          // 消费属性值和引号
          advanceByNum(value.length);
          advanceByNum(1);
        } else {
          throw new Error("缺少引号错误");
        }
      } else {
        // 不是引号
        const match = /^[^\t\r\n\f >]+/.exec(context.template);
        value = match[0];
        // 消费属性值
        advanceByNum(value.length);
      }

      // 消费空格
      advanceSpaces();

      props.push({
        type: "Attribute",
        name,
        value,
      });
    }

    return props;
  }
  // 解析元素标签
  function ___parseTag(context, type = "start") {
    const { advanceByNum, advanceSpaces } = context;
    // 匹配开始和结束标签 <div & </div
    const match =
      type === "start"
        ? /^<([a-z][^\t\r\n\f />]*)/i.exec(context.template)
        : /^<\/([a-z][^\t\r\n\f />]*)/i.exec(context.template);
    // 标签名
    const tag = match[1];
    // 消费匹配的内容和空白字符
    advanceByNum(match[0].length);
    advanceSpaces();

    // 解析属性
    const props = ____parseAttr(context);

    // 是否自闭合标签
    const isSelfClosing = context.template.startsWith("/>");

    // 消费/> 或>
    advanceByNum(isSelfClosing ? 2 : 1);

    return {
      type: "Element",
      tag,
      isSelfClosing,
      props,
      children: [],
    };
  }
  // 解析元素
  function __parserElement(context, parentStack) {
    // 解析开始标签
    const node = ___parseTag(context);
    // 如果是自闭合标签直接返回
    if (node.isSelfClosing) return node;

    // 切换到正确的文本模式
    if (["title", "textarea"].includes(node.tag)) {
      context.mode = TextMode.RCDATA;
    } else if (
      ["style", "xmp", "iframe", "noembed", "noframes", "noscript"].includes(
        node.tag
      )
    ) {
      context.mode = TextMode.RAWTEXT;
    } else {
      context.mode = TextMode.DATA;
    }

    // 添加父节点栈
    parentStack.push(node);
    // 递归解析子元素
    node.children = _parseChildren(context, parentStack);
    // 弹出父节点栈
    parentStack.pop();
    // 自己写法: 解析完子节点设置回DATA
    context.mode = TextMode.DATA;

    // 解析结束标签
    if (context.template.startsWith(`</${node.tag}>`)) {
      ___parseTag(context, "end");
    } else {
      console.error(`${node.tag}标签缺乏闭合标签`);
    }

    return node;
  }
  // 解析插值
  function __parseInterpolation(context) {
    const { advanceByNum, advanceSpaces } = context;
    // 消费开始定界符
    advanceByNum("{{".length);
    // 获取结束定界符索引
    const closeIndex = context.template.indexOf("}}");
    if (closeIndex === -1) throw new Error("插值缺少结束定界符");
    // 获取content
    const content = context.template.slice(0, closeIndex);
    // 消费content和结束定界符
    advanceByNum(content.length);
    advanceByNum("}}".length);
    // 返回插值类型
    return {
      type: "Interpolation",
      content: {
        type: "Expression",
        content: content.trim(),
      },
    };
  }
  // 解析文本
  function __parseText(context, parentStack) {
    const { advanceByNum, mode } = context;
    if (mode === TextMode.DATA) {
      // 默认全部是文本
      let endIndex = context.template.length;
      // < 索引
      let ltIndex = context.template.indexOf("<");
      ltIndex = ltIndex === -1 ? Infinity : ltIndex;
      // {{ 索引
      let delimiterIndex = context.template.indexOf("{{");
      delimiterIndex = delimiterIndex === -1 ? Infinity : delimiterIndex;

      // 取三个中的最小索引
      endIndex = Math.min(endIndex, ltIndex, delimiterIndex);

      // 截取文本内容
      const content = context.template.slice(0, endIndex);
      // 消耗文本
      advanceByNum(content.length);

      return {
        type: "Text",
        content,
      };
    } else if (mode === TextMode.RCDATA || mode === TextMode.RAWTEXT)  {
      // 父节点
      const parent = parentStack[parentStack.length - 1];
      // 获取结束索引
      const closeIndex = context.template.indexOf(`</${parent.tag}>`);
      if (closeIndex === -1) throw new Error(`${parent.tag}缺少闭合元素`);
      // 获取content
      const content = context.template.slice(0, closeIndex);
      // 消费content和结束符号
      advanceByNum(content.length);
      // 返回插值类型
      return {
        type: "Text",
        content,
      };
    }
  }

  // 解析子节点 本质就是一个状态机
  function _parseChildren(context, parentStack) {
    let nodes = [];
    // 循环执行
    while (!__isEnd(context, parentStack)) {
      let node;
      // DATA和RCDATA模式才需要解析 RAWTEXT和CDATA模式按照文本处理
      if (context.mode === TextMode.DATA || context.mode === TextMode.RCDATA) {
        // DATA模式才支持解析标签
        if (context.mode === TextMode.DATA && context.template[0] === "<") {
          if (context.template.startsWith("<!--")) {
            // 注释节点
            node = __parseComment(context);
          } else if (context.template.startsWith("<! [CDATA[")) {
            // CDATA节点
            node = __parseCDATA(context, parentStack);
          } else if (/[a-z]/i.test(context.template[1])) {
            // 标签节点
            node = __parserElement(context, parentStack);
          } else if (context.template[1] === "/") {
            // 如果能匹配上压根不会进入循环 不能匹配上还有/说明是无效的结束标签
            throw new Error("无效的结束标签");
          }
        } else if (context.template.startsWith("{{")) {
          // 解析插值
          node = __parseInterpolation(context);
        } else {
          // 按照文本处理
          node = __parseText(context, parentStack);
        }
      } else {
        // 按照文本处理
        node = __parseText(context, parentStack);
      }
      nodes.push(node);
    }

    return nodes;
  }

  // 解析器
  function parser(template) {
    // 上下文
    const context = {
      // 模板内容
      template,
      // 当前模式 初始DATA
      mode: TextMode.DATA,
      // 消费指定数量的字符
      advanceByNum(num) {
        context.template = context.template.slice(num);
      },
      // 消费开始的空白字符
      advanceSpaces() {
        const match = /^[\t\r\n\f ]+/.exec(context.template);
        if (match) {
          context.advanceByNum(match[0].length);
        }
      },
    };
    // 获取解析后的子节点
    const nodes = _parseChildren(context, []);
    // 返回根节点
    return {
      type: "Root",
      children: nodes,
    };
  }

  /* *********例子********* */
  const str = `<div :id="id" v-if="true">
    <textarea><p>wenye</p></textarea>
    <noscript><p>wenye</p></noscript>
    <p>hello {{ name }}</p>
    <p>tempalte</p>
    <!-- comment -->
    <! [CDATA[ <p>wenye<p> ]]>
  </div>`;
  const ast = parser(str);
  console.log(ast);
})();
