<template>
  <div style="width:100%;height:100%;padding:0;margin:0">
    <div class="closeBtnContainer">
      <el-button type="info" icon="el-icon-close" class="closeBtn" @click="closeContainer" circle>
      </el-button>
    </div>
    <markdown-viewer v-if="type == 'help'" :src="filePath"></markdown-viewer>
    <!-- <markdown-viewer v-else-if="type == 'history'" :src="filePath"></markdown-viewer>
        <markdown-viewer v-else-if="type == 'setting'" :src="filePath"></markdown-viewer> -->
    <map-shaper v-else-if="type == 'mapshaper'"></map-shaper>
    <slot v-else></slot>
  </div>
</template>

<script>
import { MarkdownViewer } from "./ThreejsModelViewer/VueModel";
import MapShaper from "@/components/MapShaper";

var path = require("path");
export default {
  components: { MarkdownViewer, MapShaper },
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
  methods: {
    closeContainer() {
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

<style scoped>
.closeBtn {
  background-color: rgba(68, 165, 230, 0.301);
  margin: 15px;
}

.closeBtnContainer {
  position: fixed;
  margin-top: 5px;
  right: 5px;
}

</style>

