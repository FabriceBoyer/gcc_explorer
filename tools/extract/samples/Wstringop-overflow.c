// FLAGS: -Wstringop-overflow -O2
#include <string.h>
void fill(void) {
    char buf[4];
    memset(buf, 0, 16);
}
