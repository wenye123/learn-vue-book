export default {
  name: "asyncCom",
  props: {
    title: String,
  },
  setup(props, { attrs, emit, slots }) {
    return function () {
      return {
        type: "div",
        key: "异步组件",
        children: [
          {
            type: "div",
            key: "异步组件文本",
            props: {
              onClick() {
                emit("click", "wenye");
              }
            },
            children: props.title + ": 这是一个异步组件, 点击emit",
          },
          slots && slots.default && slots.default(),
        ],
      };
    };
  },
};
