(() => {
  const { effect, reactive } = Vue;

  // flush中prev和post表示组件更新前后 pre这里模拟不出来 sync就是默认情况
  function watch(source, cb, options = {}) {
    let oldVal, newVal;
    // 遍历访问收集依赖
    const getter =
      typeof source === "function" ? source : () => traverse(source);

    const job = () => {
      newVal = effectFn();
      cb(newVal, oldVal);
      oldVal = newVal;
    };
    const effectFn = effect(getter, {
      lazy: true,
      scheduler: () => {
        // flush post情况
        if (options.flush === "post") {
          const p = Promise.resolve();
          p.then(job);
        } else {
          job();
        }
      },
    });

    // 判断是否立即执行
    if (options.immediate) {
      job();
    } else {
      oldVal = effectFn();
    }
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
  watch(
    obj,
    () => {
      console.log("执行watch");
    },
    {
      immediate: true,
      flush: "post"
    }
  );

  obj.name = "yiye";

  console.log("end");
})();
