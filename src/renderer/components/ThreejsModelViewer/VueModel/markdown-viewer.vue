<template>
  <div class="dragTarget docContainer">
    <div v-html="docContent" class="dragTarget markdown-body" style="width: 95%; height: 100%;margin:0 auto;"></div>
  </div>
</template>

<script>
import "github-markdown-css/github-markdown.css";
import "emoji-data-css/files/gl-32-emoji.css";
const fs = require("fs");
const marked = require("marked");
const emoji = require("node-emoji");

const emoji_format = function(code, name) {
  return '<div class="gl gl-' + name + '"></div>';
};

const onMissing = function(name) {
  return ":"+name+":";
};

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
        var content = marked(data.toString());
        that.docContent = emoji.emojify(content, onMissing, emoji_format);
      });
    }
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
