(() => {
  const { effect, reactive } = Vue;

  function watch(source, cb) {
    let oldVal, newVal;
    // 遍历访问收集依赖
    const getter =
      typeof source === "function" ? source : () => traverse(source);
    const effectFn = effect(getter, {
      lazy: true,
      scheduler() {
        newVal = effectFn();
        cb(newVal, oldVal);
        oldVal = newVal;
      },
    });
    oldVal = effectFn();
  }

  // 遍历访问
  function traverse(obj, seen = new Set()) {
    // 原始值或者已经读过的则跳过
    if (typeof obj !== "object" || obj === null || seen.has(obj)) return;
    // 将数据添加到set中 避免循环引用
    seen.add(obj);
    // 递归执行 不考虑除对象之外其他情况
    for (let key in obj) {
      traverse(obj[key], seen);
    }
    return obj;
  }

  const obj = reactive({ name: "wenye" });
  watch(obj, () => {
    console.log("执行watch");
  });
  watch(
    () => {
      return obj.name;
    },
    (n, o) => {
      console.log("执行watch-fn", n, o);
    }
  );

  obj.name = "yiye";
})();
