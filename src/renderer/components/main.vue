<template>
  <div class="container">
    <el-container id="main">
      <el-header class="header" height="36px" style="-webkit-app-region: drag">
        <header-view></header-view>
      </el-header>
      <el-main class="main">
        <threejs-model-viewer></threejs-model-viewer>
      </el-main>
    </el-container>
  </div>
</template>
<script>
import HeaderView from "@/components/Header";
import ThreejsModelViewer from "@/components/ThreejsModelViewer";

export default {
  data() {
    return {};
  },
  components: { HeaderView,ThreejsModelViewer }
};
</script>

<style scoped>
.container,
#main {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}

.main {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
}

.header {
  margin: 0;
  padding: 0;
  width: 100%;
}
</style>