<template>
    <div class="wrapper">
        <iframe ref="myframe" :src="src"></iframe>
    </div>
</template>

<script>
export default {
  name: "electron-iframe",
  props: {
    relative: {
      type: Boolean,
      default: false,
      required: false
    },
    src: {
      type: String,
      required: true
    }
  },
  data() {
    return {};
  },
  created() {
    if (this.relative && process.env.NODE_ENV !== "development") {
      this.src = `file://${__dirname}/` + this.src;
    }
  },
  mounted() {
    //阻止默认拖拽行为
    let frame = this.$refs.myframe;
    frame.onload = function() {
      let doc = frame.contentWindow.document;
      doc.addEventListener("drop", function(e) {
        e.preventDefault();
        e.stopPropagation();
      });
      doc.addEventListener("dragover", function(e) {
        e.preventDefault();
        e.stopPropagation();
      });
    };
  }
};
</script>

<style scoped>
.wrapper {
  padding: 0;
  margin: 0;
  display: flex;
  width: 100%;
  height: 100%;
}

iframe {
  padding: 0;
  margin: 0;
  border: 0;
  width: 100%;
  height: 100%;
}
</style>