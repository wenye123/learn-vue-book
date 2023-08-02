(() => {
  function effect() {
    document.body.innerText = obj.text;
  }

  const bucket = new Set();
  const data = { text: "wenye" };
  const obj = new Proxy(data, {
    get(target, key) {
      bucket.add(effect); // 收集依赖
      return target[key];
    },
    set(target, key, newVal) {
      target[key] = newVal;
      bucket.forEach((fn) => fn()); // 执行依赖
      return true;
    },
  });

  effect(); // 执行副作用函数触发依赖收集
  setTimeout(() => {
    obj.text = "yiye"; // 修改值触发依赖
  }, 1000);
})();
