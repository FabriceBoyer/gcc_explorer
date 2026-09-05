/*
 * Runtime benchmark.
 *
 * A deterministic mix of the workloads compiler flags actually move the needle
 * on: dense array arithmetic (vectorisation), pointer chasing (cache and frame
 * layout), bounded string/memory work (_FORTIFY_SOURCE), allocation churn
 * (sanitizers) and non-inlinable call overhead (stack protector, CET).
 *
 * It prints a checksum so nothing can be optimised away, and takes the same
 * number of steps on every run so two timings are comparable.
 *
 * Known limitation: a large share of the time is spent inside libc (malloc,
 * memset, memcpy, strlen), which is already compiled. That makes the benchmark
 * excellent at separating instrumentation overhead — sanitizers, profiling,
 * coverage all show up clearly — and poor at separating optimisation levels,
 * where most of the difference would be in our own code. The -O family is
 * therefore scored from a curated verdict rather than from these numbers.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define N     220
#define ITERS 60
#define CHAIN 40000

static unsigned long rng_state = 0x2545F4914F6CDD1DUL;
static unsigned long rng(void) {
  rng_state ^= rng_state << 13;
  rng_state ^= rng_state >> 7;
  rng_state ^= rng_state << 17;
  return rng_state;
}

/* Dense floating point: the part -O3 / -ffast-math / -march change. */
static double matmul(const double *a, const double *b, double *c) {
  for (int i = 0; i < N; ++i)
    for (int k = 0; k < N; ++k) {
      double aik = a[i * N + k];
      for (int j = 0; j < N; ++j) c[i * N + j] += aik * b[k * N + j];
    }
  return c[(N - 1) * N + N - 1];
}

/* Pointer chasing: sensitive to frame pointers and to sanitizer shadow lookups. */
struct link { struct link *next; long v; };

static long chase(struct link *head, int rounds) {
  long acc = 0;
  for (int r = 0; r < rounds; ++r)
    for (struct link *p = head; p; p = p->next) acc += p->v ^ r;
  return acc;
}

/* Bounded string and memory work: the part _FORTIFY_SOURCE instruments. */
static long strings(int rounds) {
  char buf[256];
  long acc = 0;
  for (int r = 0; r < rounds; ++r) {
    memset(buf, 'a' + (r & 15), sizeof buf - 1);
    buf[sizeof buf - 1] = '\0';
    acc += (long) strlen(buf);
    char copy[256];
    memcpy(copy, buf, sizeof copy);
    acc += copy[r % 200];
  }
  return acc;
}

/* Allocation churn: where AddressSanitizer and friends cost the most. */
static long churn(int rounds) {
  long acc = 0;
  for (int r = 0; r < rounds; ++r) {
    size_t n = 64 + (rng() % 512);
    unsigned char *p = malloc(n);
    if (!p) return -1;
    memset(p, (int) (r & 0xff), n);
    acc += p[n / 2];
    free(p);
  }
  return acc;
}

/* Many small non-inlined calls: stack protector and CET prologue overhead. */
__attribute__((noinline)) static long leaf(long x) { return x * 2654435761L + 1; }

static long calls(int rounds) {
  long acc = 0;
  for (int r = 0; r < rounds; ++r) acc = leaf(acc ^ r);
  return acc;
}

int main(void) {
  double *a = malloc(sizeof(double) * N * N);
  double *b = malloc(sizeof(double) * N * N);
  double *c = calloc((size_t) N * N, sizeof(double));
  struct link *head = NULL;
  if (!a || !b || !c) return 1;

  for (int i = 0; i < N * N; ++i) {
    a[i] = (double) (rng() % 1000) / 7.0;
    b[i] = (double) (rng() % 1000) / 11.0;
  }
  for (int i = 0; i < CHAIN; ++i) {
    struct link *n = malloc(sizeof *n);
    if (!n) return 1;
    n->v = (long) rng();
    n->next = head;
    head = n;
  }

  double acc = matmul(a, b, c);
  long lacc = 0;
  for (int it = 0; it < ITERS; ++it) {
    lacc += chase(head, 1);
    lacc += strings(4000);
    lacc += churn(4000);
    lacc += calls(200000);
  }

  printf("%ld\n", (long) acc ^ lacc);

  while (head) { struct link *n = head->next; free(head); head = n; }
  free(a); free(b); free(c);
  return 0;
}
