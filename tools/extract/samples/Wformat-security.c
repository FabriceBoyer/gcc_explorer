// FLAGS: -Wformat -Wformat-security
#include <stdio.h>
void f(const char *untrusted) { printf(untrusted); }
