<template>
  <div class="wrapper">
    <div class="header" ondragstart="return false;">
      <h1>Three glTF Viewer</h1>
    </div>
    <model-container :fileInfo="fileInfo" @importFile="validateExt" v-if="showCanvas"></model-container>
    <div v-else class="drop-container">
      <div ref="dragDiv" :class="['drop-area','dragTarget',{'hover':isHover}]">
        <p>拖拽文件到这里，或者</p>
        <el-button type="primary" icon="el-icon-search" @click="openFile">打开本地文件</el-button>
      </div>
    </div>
  </div>
</template>

<script>
import ModelContainer from "./ModelContainer";
import { filters, supportExt } from "@/config/config";
const { BrowserWindow } = require("electron");

let dragEvent = false;
let openFileEvent = false;

export default {
  components: { ModelContainer },
  data() {
    return {
      showCanvas: false,
      isHover: false,
      fileInfo: {}
    };
  },
  watch: {
    showCanvas(val, old) {
      this.registDragEvent();
    }
  },
  methods: {
    openFile() {
      this.$electron.ipcRenderer.send("openFile", {
        filters
      });
    },
    registDragEvent() {
      let that = this;
      if (dragEvent) return;
      dragEvent = true;
      let holder = this.$refs.dragDiv;
      holder.ondragover = function(event) {
        event.preventDefault();
        event.stopPropagation();
        that.isHover = true;
      };
      holder.ondragleave = function(event) {
        event.preventDefault();
        event.stopPropagation();
        that.isHover = false;
      };
      holder.ondrop = function(event) {
        event.preventDefault();
        event.stopPropagation();
        that.isHover = false;
        var efile = event.dataTransfer.files[0];
        that.validateExt(efile.path);
      };
    },
    registOpenFile() {
      let that = this;
      if (openFileEvent) return;
      openFileEvent = true;
      that.$electron.ipcRenderer.on("open-file", (event, { data }) => {
        if (data && data[0]) {
          this.validateExt(data[0]);
        }
      });
    },
    validateExt(path) {
      console.log(path);
      let index = path.lastIndexOf(".");
      if (index == -1) {
        this.info("未识别指定文件格式");
        return;
      }
      var _ext = path.substring(index).toLowerCase();
      if (!supportExt.includes(_ext)) {
        this.info("指定文件格式不支持");
        return;
      }
      this.fileInfo = { ext: _ext, path: path };
      this.showCanvas = true;
    },
    info(msg) {
      this.$message({
        showClose: true,
        message: msg
      });
    }
  },
  mounted() {
    if (!this.showCanvas) this.registDragEvent();
    this.registOpenFile();
  }
};
</script>

<style scoped>
.wrapper {
  padding: 0;
  margin: 0;
  width: 100%;
  height: 100%;
}

/******************************************************************************
   * Header
   */

.header {
  position: fixed;
  display: flex;
  background: #353535;
  padding: 0 1em;
  height: 2.5rem;
  line-height: 2.5rem;
  align-items: center;
  width: 100%;
  -webkit-app-region: no-drag;
}

.header h1 {
  color: #f5f5f5;
  font-weight: 300;
  line-height: 4rem;
  font-size: 1.4rem;
  margin: 0;
}

@media screen and (max-width: 700px) {
  .header h1 {
    font-size: 1em;
  }

  .layout-md {
    display: none;
  }
}

.drop-area p {
  margin-top: 100px;
}

.drop-area {
  background-color: rgb(248, 253, 255);
  border-width: 2px;
  border-style: dashed;
  border-color: rgb(162, 162, 162);
  border-image: initial;
  border-radius: 19px;
  height: 300px;
  font-size: 1.5rem;
  color: dimgray;
  min-width: 300px;
  max-width: 500px;
  width: 50%;
  margin: 0 auto;
  text-align: center;
}

.hover {
  box-shadow: 0px 0px 8px 2px rgba(81, 203, 238, 0.8);
}

.drop-container {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: Center;
  widows: 100%;
}

.canvas {
  position: fixed;
}
</style>