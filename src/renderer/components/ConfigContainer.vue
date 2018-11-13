<template>
    <div>
      <div style="width:80px;height:80px;position: fixed;margin-top:5px;right: 5px;">
        <el-button @click="closeContainer">关闭</el-button>
      </div>
        <markdown-viewer v-if="type == 'help'" :src="filePath"></markdown-viewer>
        <!-- <markdown-viewer v-else-if="type == 'history'" :src="filePath"></markdown-viewer>
        <markdown-viewer v-else-if="type == 'setting'" :src="filePath"></markdown-viewer> -->
    </div>
</template>

<script>
import { MarkdownViewer } from "./ThreejsModelViewer/VueModel";
var path = require("path");
export default {
  components: { MarkdownViewer },
  props: {
    appData: {
      type: Object,
      default: {
        type: undefined,
        data: undefined
      }
    }
  },
  data() {
    return {
      filePath: "",
      type: undefined,
      data: undefined
    };
  },
  watch: {
    appData(val) {
      this.type = val.type;
      this.data = val.data;
    }
  },
  methods:{
    closeContainer(){
      this.$emit("close");
    }
  },
  mounted() {
    var _path = "help/help.md";
    if (process.env.NODE_ENV !== "development") {
      _path = path.join("resources", _path);
    }
    this.filePath = _path;

    this.type = this.appData.type;
    this.data = this.appData.data;
  }
};
</script>
