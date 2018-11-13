import ModelStl from "./model-stl";
import ModelPly from "./model-ply";
import ModelCollada from "./model-collada";
import ModelGltf from "./model-gltf";
import ModelPcd from "./model-pcd";
import ModelObj from "./model-obj";
import MarkdownViewer from "./markdown-viewer";

const components = [
  ModelStl,
  ModelPly,
  ModelCollada,
  ModelGltf,
  ModelObj,
  ModelPcd,
  MarkdownViewer
];

const install = Vue => {
  components.map(component => {
    Vue.component(component.name, component);
  });
};

if (typeof window !== "undefined" && window.Vue) {
  install(window.Vue);
}

export default {
  install,
  ModelStl,
  ModelPly,
  ModelCollada,
  ModelGltf,
  ModelObj,
  ModelPcd,
  MarkdownViewer
};

export {
  install,
  ModelStl,
  ModelPly,
  ModelCollada,
  ModelGltf,
  ModelObj,
  ModelDraco,
  ModelPcd,
  MarkdownViewer
};
