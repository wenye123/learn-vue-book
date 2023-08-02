(() => {
  const { effect, track, trigger } = Vue;

  {
    // 拦截对象调用
    function fn() {
      console.log("执行函数");
    }
    const p = new Proxy(fn, {
      apply(target, thisArg, args) {
        target.call(thisArg, ...args);
      },
    });
    p();
  }

  {
    const obj = {
      foo: 1,
      // 让foo字段也能收集依赖
      get bar() {
        return this.foo;
      },
    };

    // 手动执行方法
    const p = new Proxy(obj, {
      get(target, key) {
        track(target, key);
        return target[key];
      },
      set(target, key, val) {
        target[key] = val;
        trigger(target, key, val);
      },
    });
    effect(() => {
      console.log("p1", p.bar);
    });
    p.foo++; // 这种写法不会打印2 因为this.foo中的this指向的obj

    // reflect写法
    const p2 = new Proxy(obj, {
      get(target, key, receiver) {
        track(target, key);
        return Reflect.get(target, key, receiver);
      },
      set(target, key, val, receiver) {
        Reflect.set(target, key, val, receiver);
        trigger(target, key, val);
      },
    });
    effect(() => {
      console.log("p2", p2.bar);
    });
    p2.foo++; // 修改了this指向 会打印3
  }

})();
