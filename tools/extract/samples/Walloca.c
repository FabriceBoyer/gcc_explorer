// FLAGS: -Walloca -Walloca-larger-than=8
#include <alloca.h>
void *grab(unsigned n) {
    return alloca(n);
}
