// FLAGS: -std=c++11 -Wpessimizing-move
#include <string>
#include <utility>
std::string f() { std::string s("example"); return std::move(s); }
