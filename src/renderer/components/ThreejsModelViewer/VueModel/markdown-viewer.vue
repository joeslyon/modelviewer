<template>
  <div class="dragTarget docContainer">
    <div v-html="docContent" class="dragTarget markdown-body" style="width: 95%; height: 100%;margin:0 auto;"></div>
  </div>
</template>

<script>
import "github-markdown-css/github-markdown.css";
var fs = require("fs");
var marked = require("marked");

export default {
  name: "markdown-viewer",
  props: {
    src: {
      type: String
    }
  },
  data() {
    return {
      docContent: ""
    };
  },
  watch: {
    src() {
      this.reload();
    }
  },
  methods: {
    reload() {
      var that = this;
      if (that.src == "") return;
      fs.readFile(that.src, function(err, data) {
        if (err) {
          return console.error(err);
        }
        that.docContent = marked(data.toString());
      });
    },
  },
  mounted() {
    this.reload();
  }
};
</script>

<style scoped>
.docContainer {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: Center;
  overflow: auto;
}
</style>
