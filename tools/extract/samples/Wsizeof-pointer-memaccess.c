// FLAGS: -Wall -Wsizeof-pointer-memaccess
#include <string.h>
void f(char *dst, const char *src) { memcpy(dst, src, sizeof dst); }
