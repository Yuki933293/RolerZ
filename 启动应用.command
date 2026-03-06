#!/bin/bash
# 双击此文件即可启动 Persona Forge 界面

cd "$(dirname "$0")"

# 检查 streamlit 是否安装
if ! python3 -m streamlit --version &>/dev/null; then
    echo "正在安装依赖，请稍候..."
    pip3 install streamlit
fi

echo ""
echo "================================"
echo "  Persona Forge 正在启动..."
echo "  浏览器会自动打开"
echo "  关闭此窗口即可停止应用"
echo "================================"
echo ""

python3 -m streamlit run app.py
