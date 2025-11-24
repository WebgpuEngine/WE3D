struct st_location {
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
    $st_location_ref  //引用位置占位符
}
